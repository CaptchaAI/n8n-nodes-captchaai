import type { ILoadOptionsFunctions } from 'n8n-workflow';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CaptchaAi } from '../nodes/CaptchaAi/CaptchaAi.node';
import { nodeProperties } from '../nodes/CaptchaAi/descriptions';
import { settingsDescription } from '../nodes/CaptchaAi/descriptions/settingDescription';

/**
 * The Thread Balance field is a readout driven by loadOptions rather than an
 * input, so these tests cover the two things that make it one: it asks the API
 * for the balance of the credential on this node, and it always comes back
 * with a single option whose value matches the field default, which is what
 * makes the text show without the user picking anything.
 */
type ThreadsResponse = { status: number; request: string; threads?: number; working_threads?: number };

function stubThreadsApi(response: ThreadsResponse) {
	const apiKeys: string[] = [];

	vi.stubGlobal(
		'fetch',
		vi.fn(async (url: string, init?: { body?: string }) => {
			const parsed = new URL(url);
			const params = new URLSearchParams(init?.body ?? parsed.search);
			apiKeys.push(params.get('key') ?? '');
			return { status: 200, text: async () => JSON.stringify(response) };
		}),
	);

	return { apiKeys };
}

function mockLoadOptionsFunctions(apiKey: string) {
	return {
		getCredentials: async () => ({ apiKey }),
	} as unknown as ILoadOptionsFunctions;
}

const node = new CaptchaAi();
const getThreadBalance = node.methods.loadOptions.getThreadBalance;

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('Thread Balance field', () => {
	it('sits above the CAPTCHA Type dropdown', () => {
		const names = nodeProperties.map((property) => property.name);
		expect(names.indexOf('threadBalance')).toBe(0);
		expect(names.indexOf('threadBalance')).toBeLessThan(names.indexOf('captchaType'));
	});

	/**
	 * Editing an API key leaves node.credentials unchanged (id + name only),
	 * so n8n will not refetch on its own. The refresh toggle is what
	 * loadOptionsDependsOn watches to force a new reading.
	 */
	it('refetches when the refresh toggle changes', () => {
		const balance = nodeProperties.find((property) => property.name === 'threadBalance');
		const refresh = nodeProperties.find((property) => property.name === 'threadBalanceRefresh');

		expect(refresh).toMatchObject({ type: 'boolean', default: false });
		expect(balance?.typeOptions).toMatchObject({
			loadOptionsMethod: 'getThreadBalance',
			loadOptionsDependsOn: ['threadBalanceRefresh'],
		});
		expect(nodeProperties.map((property) => property.name).indexOf('threadBalance')).toBeLessThan(
			nodeProperties.map((property) => property.name).indexOf('threadBalanceRefresh'),
		);
	});

	it('loads its reading from the credential on this node', async () => {
		const apiKey = 'b'.repeat(32);
		const { apiKeys } = stubThreadsApi({
			status: 1,
			request: 'OK',
			threads: 15,
			working_threads: 3,
		});

		const options = await getThreadBalance.call(mockLoadOptionsFunctions(apiKey));

		expect(options).toEqual([{ name: '12 of 15 threads free · 3 currently in use', value: '' }]);
		expect(new Set(apiKeys)).toEqual(new Set([apiKey]));
	});

	it('reports a rejected key in place of the reading', async () => {
		stubThreadsApi({ status: 0, request: 'ERROR_KEY_DOES_NOT_EXIST' });

		const options = await getThreadBalance.call(mockLoadOptionsFunctions('nope'));

		expect(options).toEqual([
			{ name: 'Thread balance unavailable: CaptchaAI rejected this API key', value: '' },
		]);
	});

	it('never reports more free threads than the plan has', async () => {
		stubThreadsApi({ status: 1, request: 'OK', threads: 2, working_threads: 5 });

		const [option] = await getThreadBalance.call(mockLoadOptionsFunctions('c'.repeat(32)));

		expect(option.name).toBe('0 of 2 threads free · 5 currently in use');
	});
});

describe('Settings notice', () => {
	const settings = settingsDescription[0];
	const options = settings.options as Array<{ name: string; type: string }>;

	it('is the first thing in the collection', () => {
		expect(options[0]).toMatchObject({ name: 'settingsNotice', type: 'notice' });
	});

	/**
	 * n8n renders a collection option only when the collection's value carries
	 * its key, and offers every other option under "Add Setting". Seeding the
	 * default is what makes the notice static rather than addable.
	 */
	it('is seeded into the collection default so it renders instead of being offered', () => {
		expect(settings.default).toEqual({ settingsNotice: '' });
	});
});
