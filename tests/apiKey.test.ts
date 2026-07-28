import type {
	ICredentialDataDecryptedObject,
	ICredentialTestFunctions,
	ICredentialsDecrypted,
	IExecuteFunctions,
	ILoadOptionsFunctions,
} from 'n8n-workflow';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CaptchaAi } from '../nodes/CaptchaAi/CaptchaAi.node';
import { resolveApiKey } from '../nodes/CaptchaAi/libs/sdk';

/**
 * The credential's API key gets trimmed before it reaches the SDK, and a key
 * that is only whitespace is refused before any request goes out.
 *
 * Both matter because of how the two layers above disagree. n8n's `required`
 * flag on a credential field only tests for a non-empty string, so a single
 * space saves cleanly and the credential shows no issue. The SDK then measures
 * `apiKey.trim().length` but sends the key untrimmed, so a padded but
 * otherwise correct key clears its check and comes back from the API as "Key
 * must be 32 characters" - about a key that is exactly 32 characters.
 */
const VALID_KEY = 'a'.repeat(32);

function stubApi() {
	const keys: string[] = [];

	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string, init?: { body?: string }) => {
			const parsed = new URL(url);
			const params = new URLSearchParams(init?.body ?? parsed.search);
			keys.push(params.get('key') ?? '');

			let body: Record<string, unknown>;
			if (params.get('action') === 'threadsinfo') {
				body = { status: 1, request: 'OK', threads: 10, working_threads: 0 };
			} else if (parsed.pathname.endsWith('in.php')) {
				body = { status: 1, request: '1001' };
			} else {
				body = { status: 1, request: 'solved-token' };
			}

			return { status: 200, text: async () => JSON.stringify(body) };
		}),
	);

	return { keys };
}

const node = new CaptchaAi();

function runCredentialTest(apiKey: unknown) {
	return node.methods.credentialTest.captchaAiApiTest.call(
		{} as ICredentialTestFunctions,
		{ data: { apiKey } } as unknown as ICredentialsDecrypted<ICredentialDataDecryptedObject>,
	);
}

function runThreadBalance(apiKey: unknown) {
	return node.methods.loadOptions.getThreadBalance.call({
		getCredentials: async () => ({ apiKey }),
	} as unknown as ILoadOptionsFunctions);
}

function runExecute(apiKey: unknown) {
	return node.execute.call({
		getInputData: () => [{ json: {} }],
		getNode: () => ({
			id: 'node-1',
			name: 'CaptchaAI',
			type: 'n8n-nodes-captchaai.captchaAi',
			typeVersion: 1,
			position: [0, 0] as [number, number],
			parameters: {},
		}),
		continueOnFail: () => false,
		getCredentials: async () => ({ apiKey }),
		getNodeParameter: (name: string, _itemIndex: number, fallback?: unknown) =>
			({ captchaType: 'normal', image: 'aGVsbG8=' })[name] ?? fallback,
	} as unknown as IExecuteFunctions);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('resolveApiKey', () => {
	it('strips whitespace left around a pasted key', () => {
		expect(resolveApiKey(`  ${VALID_KEY}\n`)).toBe(VALID_KEY);
	});

	it.each([
		['an empty string', ''],
		['only spaces', '   '],
		['a tab and a newline', '\t\n'],
		['nothing at all', undefined],
		['a non-string', 42],
	])('refuses %s', (_label, value) => {
		expect(() => resolveApiKey(value)).toThrow('The CaptchaAI API key is empty');
	});
});

describe('credential test', () => {
	it('refuses a whitespace-only key without contacting the API', async () => {
		const { keys } = stubApi();

		await expect(runCredentialTest('   ')).resolves.toEqual({
			status: 'Error',
			message: 'The API key is empty. Paste the 32-character key from your CaptchaAI dashboard.',
		});
		expect(keys).toEqual([]);
	});

	it('accepts a key pasted with whitespace and sends it trimmed', async () => {
		const { keys } = stubApi();

		const result = await runCredentialTest(` ${VALID_KEY} `);

		expect(result.status).toBe('OK');
		expect(new Set(keys)).toEqual(new Set([VALID_KEY]));
	});
});

describe('thread balance readout', () => {
	it('shows the reason instead of a balance when the key is blank', async () => {
		const { keys } = stubApi();

		await expect(runThreadBalance(' ')).resolves.toEqual([
			{ name: 'Thread balance unavailable: The CaptchaAI API key is empty', value: '' },
		]);
		expect(keys).toEqual([]);
	});
});

describe('execute', () => {
	it('fails the run with a readable error before any request', async () => {
		const { keys } = stubApi();

		await expect(runExecute('  ')).rejects.toMatchObject({
			message: 'The CaptchaAI API key is empty',
			description: expect.stringContaining('32-character key'),
		});
		expect(keys).toEqual([]);
	});

	it('solves with a key pasted with whitespace, sending it trimmed', async () => {
		const { keys } = stubApi();

		const [output] = await runExecute(`\t${VALID_KEY} `);

		expect(output[0].json.solution).toBe('solved-token');
		expect(new Set(keys)).toEqual(new Set([VALID_KEY]));
	});
});
