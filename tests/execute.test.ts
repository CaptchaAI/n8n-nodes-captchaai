import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CaptchaAi } from '../nodes/CaptchaAi/CaptchaAi.node';

/**
 * End-to-end coverage of execute() against a stubbed CaptchaAI API.
 *
 * The `normal` CAPTCHA type is used throughout because it has the shortest
 * initial poll wait in the SDK's registry, which keeps these tests quick.
 */
type ApiCall = { url: string; params: URLSearchParams };

interface StubOptions {
	/** Response for POST in.php. Defaults to a task ID. */
	submit?: (call: ApiCall) => Record<string, unknown>;
	/** Response for GET res.php?action=get. Defaults to a solved token. */
	poll?: (call: ApiCall) => Record<string, unknown>;
	threads?: Record<string, unknown>;
}

function stubApi(options: StubOptions = {}) {
	const calls: ApiCall[] = [];
	let nextTaskId = 1000;

	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string, init?: { body?: string }) => {
			const parsed = new URL(url);
			const params = new URLSearchParams(init?.body ?? parsed.search);
			const call = { url: parsed.pathname, params };
			calls.push(call);

			let body: Record<string, unknown>;
			if (params.get('action') === 'threadsinfo') {
				body = options.threads ?? { status: 1, request: 'OK', threads: 10, working_threads: 0 };
			} else if (parsed.pathname.endsWith('in.php')) {
				nextTaskId += 1;
				body = options.submit?.(call) ?? { status: 1, request: String(nextTaskId) };
			} else {
				body = options.poll?.(call) ?? { status: 1, request: 'solved-token' };
			}

			return { status: 200, text: async () => JSON.stringify(body) };
		}),
	);

	return { calls };
}

/** A base64 image unique to an item, so stub responses can be keyed off it. */
function imageFor(itemIndex: number) {
	return Buffer.from('item-' + itemIndex).toString('base64');
}

function mockExecuteFunctions(
	itemCount: number,
	/** A function value is resolved per item, everything else is shared. */
	parameters: Record<string, unknown | ((itemIndex: number) => unknown)>,
	options: { continueOnFail?: boolean } = {},
) {
	const items: INodeExecutionData[] = Array.from({ length: itemCount }, (_unused, index) => ({
		json: { index },
	}));

	const node = {
		id: 'node-1',
		name: 'CaptchaAI',
		type: 'n8n-nodes-captchaai.captchaAi',
		typeVersion: 1,
		position: [0, 0] as [number, number],
		parameters: {},
	};

	return {
		getInputData: () => items,
		getNode: () => node,
		continueOnFail: () => options.continueOnFail === true,
		getCredentials: async () => ({ apiKey: 'a'.repeat(32) }),
		getNodeParameter: (name: string, itemIndex: number, fallback?: unknown) => {
			if (!(name in parameters)) return fallback;
			const value = parameters[name];
			return typeof value === 'function' ? value(itemIndex) : value;
		},
	} as unknown as IExecuteFunctions;
}

const node = new CaptchaAi();

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('CaptchaAi.execute', () => {
	it('returns no items for empty input without calling the API', async () => {
		const { calls } = stubApi();
		const output = await node.execute.call(
			mockExecuteFunctions(0, { captchaType: 'normal', image: 'aGVsbG8=' }),
		);

		expect(output).toEqual([[]]);
		expect(calls).toEqual([]);
	});

	it('solves an item and emits the agreed output shape', async () => {
		stubApi();
		const [output] = await node.execute.call(
			mockExecuteFunctions(1, { captchaType: 'normal', image: 'aGVsbG8=' }),
		);

		expect(output).toHaveLength(1);
		expect(output[0].json).toEqual({
			captchaType: 'normal',
			taskId: '1001',
			solution: 'solved-token',
		});
		expect(output[0].pairedItem).toEqual({ item: 0 });
	});

	it('validates the key once per execution, not once per item', async () => {
		const countThreadChecks = async (itemCount: number) => {
			const { calls } = stubApi();
			await node.execute.call(
				mockExecuteFunctions(itemCount, {
					captchaType: 'normal',
					image: 'aGVsbG8=',
					executionMode: 'parallel',
					batchSize: itemCount,
				}),
			);
			vi.unstubAllGlobals();
			return calls.filter((call) => call.params.get('action') === 'threadsinfo').length;
		};

		// The count is whatever the SDK does per client - the point is that it
		// does not grow with the number of items, because the node builds one
		// client for the whole execution.
		expect(await countThreadChecks(4)).toBe(await countThreadChecks(1));
	});

	it('keeps output aligned with input when solving in parallel', async () => {
		// Task IDs are derived from the item's own image rather than handed out
		// in submit order, so this fails if results are collected out of order.
		stubApi({
			submit: (call) => ({ status: 1, request: 'task-' + call.params.get('body') }),
			poll: (call) => ({ status: 1, request: 'token-for-' + call.params.get('id') }),
		});

		const [output] = await node.execute.call(
			mockExecuteFunctions(4, {
				captchaType: 'normal',
				image: imageFor,
				executionMode: 'parallel',
				batchSize: 4,
			}),
		);

		expect(output.map((item) => item.json.solution)).toEqual([
			'token-for-task-' + imageFor(0),
			'token-for-task-' + imageFor(1),
			'token-for-task-' + imageFor(2),
			'token-for-task-' + imageFor(3),
		]);
		expect(output.map((item) => item.pairedItem)).toEqual([
			{ item: 0 },
			{ item: 1 },
			{ item: 2 },
			{ item: 3 },
		]);
	});

	it('sends the parameters the API expects', async () => {
		const { calls } = stubApi();
		await node.execute.call(
			mockExecuteFunctions(1, {
				captchaType: 'normal',
				image: 'aGVsbG8=',
				numeric: 1,
				minLength: 4,
				instructions: 'Type the text',
			}),
		);

		const submit = calls.find((call) => call.url.endsWith('in.php'));
		expect(submit?.params.get('method')).toBe('base64');
		expect(submit?.params.get('body')).toBe('aGVsbG8=');
		expect(submit?.params.get('numeric')).toBe('1');
		expect(submit?.params.get('min_len')).toBe('4');
		expect(submit?.params.get('textinstructions')).toBe('Type the text');
		// The field is dropped rather than sent empty.
		expect(submit?.params.has('max_len')).toBe(false);
	});

	it('includes the raw response only when the setting is on', async () => {
		stubApi();
		const [withRaw] = await node.execute.call(
			mockExecuteFunctions(1, {
				captchaType: 'normal',
				image: 'aGVsbG8=',
				settings: { includeRaw: true },
			}),
		);

		expect(withRaw[0].json.raw).toEqual({ status: 1, request: 'solved-token' });
	});

	it('fails the run with a typed error that names the item', async () => {
		stubApi({ submit: () => ({ status: 0, request: 'ERROR_ZERO_CAPTCHA_FILESIZE' }) });

		await expect(
			node.execute.call(mockExecuteFunctions(1, { captchaType: 'normal', image: 'aGVsbG8=' })),
		).rejects.toMatchObject({
			message: 'Image is too small (under 100 bytes)',
			context: { itemIndex: 0 },
		});
	});

	it('keeps the task ID on the error when the poll is what failed', async () => {
		stubApi({ poll: () => ({ status: 0, request: 'ERROR_CAPTCHA_UNSOLVABLE' }) });

		await expect(
			node.execute.call(mockExecuteFunctions(1, { captchaType: 'normal', image: 'aGVsbG8=' })),
		).rejects.toMatchObject({
			description: expect.stringContaining('1001'),
		});
	});

	it('isolates a failed item under Continue On Fail', async () => {
		const failing = 'task-' + imageFor(1);
		stubApi({
			submit: (call) => ({ status: 1, request: 'task-' + call.params.get('body') }),
			poll: (call) =>
				call.params.get('id') === failing
					? { status: 0, request: 'ERROR_CAPTCHA_UNSOLVABLE' }
					: { status: 1, request: 'solved-token' },
		});

		const [output] = await node.execute.call(
			mockExecuteFunctions(
				3,
				{
					captchaType: 'normal',
					image: imageFor,
					executionMode: 'parallel',
					batchSize: 3,
				},
				{ continueOnFail: true },
			),
		);

		expect(output).toHaveLength(3);
		expect(output[0].json.solution).toBe('solved-token');
		expect(output[2].json.solution).toBe('solved-token');
		expect(output[1].json).toEqual({
			error: 'Captcha could not be solved',
			errorType: 'UnsolvableError',
			captchaType: 'normal',
			taskId: failing,
		});
	});

	it('rejects a file path before any request is made', async () => {
		const { calls } = stubApi();

		await expect(
			node.execute.call(mockExecuteFunctions(1, { captchaType: 'normal', image: '/etc/passwd' })),
		).rejects.toThrow(/file path/);

		expect(calls.filter((call) => call.url.endsWith('in.php'))).toHaveLength(0);
	});

	it('refuses a proxy-only type before any request is made', async () => {
		const { calls } = stubApi();

		await expect(
			node.execute.call(
				mockExecuteFunctions(1, {
					captchaType: 'cloudflare_challenge',
					pageUrl: 'https://example.com',
				}),
			),
		).rejects.toThrow(/requires a proxy/);

		expect(calls.filter((call) => call.url.endsWith('in.php'))).toHaveLength(0);
	});

	it('surfaces a bad API key before solving any item', async () => {
		const { calls } = stubApi({
			threads: { status: 0, request: 'ERROR_KEY_DOES_NOT_EXIST' },
		});

		await expect(
			node.execute.call(mockExecuteFunctions(2, { captchaType: 'normal', image: 'aGVsbG8=' })),
		).rejects.toThrow(/rejected the API key/);

		expect(calls.filter((call) => call.url.endsWith('in.php'))).toHaveLength(0);
	});

	it('passes the proxy pair through to the API', async () => {
		const { calls } = stubApi();
		await node.execute.call(
			mockExecuteFunctions(1, {
				captchaType: 'normal',
				image: 'aGVsbG8=',
				settings: { proxy: 'user:pass@1.2.3.4:8080', proxyType: 'SOCKS5' },
			}),
		);

		const submit = calls.find((call) => call.url.endsWith('in.php'));
		expect(submit?.params.get('proxy')).toBe('user:pass@1.2.3.4:8080');
		expect(submit?.params.get('proxytype')).toBe('SOCKS5');
	});

	it(
		'accepts the proxy pair from the top-level Proxy/Proxy Type fields (not just Settings)',
		async () => {
			const { calls } = stubApi();
			await node.execute.call(
				mockExecuteFunctions(1, {
					captchaType: 'captchafox',
					siteKey: 'fox-site-key',
					pageUrl: 'https://example.com/challenge',
					proxy: 'user:pass@1.2.3.4:8080',
					proxyType: 'SOCKS5',
				}),
			);

			const submit = calls.find((call) => call.url.endsWith('in.php'));
			expect(submit?.params.get('proxy')).toBe('user:pass@1.2.3.4:8080');
			expect(submit?.params.get('proxytype')).toBe('SOCKS5');
		},
		15000,
	);

	it(
		'prefers the top-level Proxy fields over Settings when both are set',
		async () => {
			const { calls } = stubApi();
			await node.execute.call(
				mockExecuteFunctions(1, {
					captchaType: 'captchafox',
					siteKey: 'fox-site-key',
					pageUrl: 'https://example.com/challenge',
					proxy: 'top-level@1.2.3.4:8080',
					proxyType: 'SOCKS5',
					settings: { proxy: 'from-settings@5.6.7.8:9090', proxyType: 'HTTP' },
				}),
			);

			const submit = calls.find((call) => call.url.endsWith('in.php'));
			expect(submit?.params.get('proxy')).toBe('top-level@1.2.3.4:8080');
			expect(submit?.params.get('proxytype')).toBe('SOCKS5');
		},
		15000,
	);

	it('reads CAPTCHA type per input item', async () => {
		const { calls } = stubApi({
			poll: () => ({ status: 1, request: '[1,2,3]' }),
		});
		await node.execute.call(
			mockExecuteFunctions(2, {
				captchaType: (itemIndex: number) => (itemIndex === 0 ? 'normal' : 'grid'),
				image: (itemIndex: number) => imageFor(itemIndex),
				instructions: 'Pick tiles',
				gridSize: '3x3',
			}),
		);

		const submits = calls.filter((call) => call.url.endsWith('in.php'));
		expect(submits).toHaveLength(2);
		expect(submits[0]?.params.get('method')).toBe('base64');
		expect(submits[1]?.params.get('grid_size')).toBe('3x3');
	});
});
