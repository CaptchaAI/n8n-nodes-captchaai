import { SolveResult, UnsolvableError } from 'captchaai-javascript';
import { describe, expect, it } from 'vitest';

import { toErrorItem, toOutputItem } from '../nodes/CaptchaAi/libs/output';

type SolveResultInit = ConstructorParameters<typeof SolveResult>[0];

/** SolveResultInit requires every field, so fill in the unused ones. */
function solveResult(init: Partial<SolveResultInit> & Pick<SolveResultInit, 'taskId' | 'solution'>) {
	return new SolveResult({ userAgent: undefined, raw: undefined, rawText: undefined, ...init });
}

describe('toOutputItem', () => {
	it('emits the agreed shape for a token solution', () => {
		const result = solveResult({ taskId: '123', solution: 'token-abc' });

		expect(toOutputItem(result, { captchaType: 'recaptcha_v2', itemIndex: 0, includeRaw: false }))
			.toEqual({
				json: { captchaType: 'recaptcha_v2', taskId: '123', solution: 'token-abc' },
				pairedItem: { item: 0 },
			});
	});

	it('leaves a structured solution nested', () => {
		const solution = { challenge: 'c', validate: 'v', seccode: 's' };
		const item = toOutputItem(solveResult({ taskId: '9', solution }), {
			captchaType: 'geetest',
			itemIndex: 2,
			includeRaw: false,
		});

		expect(item.json.solution).toEqual(solution);
		expect(item.pairedItem).toEqual({ item: 2 });
	});

	it('includes the user agent only when the type returns one', () => {
		const withAgent = toOutputItem(
			solveResult({ taskId: '1', solution: 't', userAgent: 'Mozilla/5.0' }),
			{ captchaType: 'recaptcha_v2_enterprise', itemIndex: 0, includeRaw: false },
		);
		const withoutAgent = toOutputItem(solveResult({ taskId: '1', solution: 't' }), {
			captchaType: 'recaptcha_v2',
			itemIndex: 0,
			includeRaw: false,
		});

		expect(withAgent.json.userAgent).toBe('Mozilla/5.0');
		expect(withoutAgent.json).not.toHaveProperty('userAgent');
	});

	it('includes the raw response only when the setting is on', () => {
		const raw = { status: 1, request: 'token' };
		const result = solveResult({ taskId: '1', solution: 'token', raw });

		expect(
			toOutputItem(result, { captchaType: 'turnstile', itemIndex: 0, includeRaw: true }).json.raw,
		).toEqual(raw);
		expect(
			toOutputItem(result, { captchaType: 'turnstile', itemIndex: 0, includeRaw: false }).json,
		).not.toHaveProperty('raw');
	});

	it('falls back to the raw text when the response was not JSON', () => {
		const result = solveResult({ taskId: '1', solution: 'token', rawText: 'OK|token' });
		const item = toOutputItem(result, {
			captchaType: 'turnstile',
			itemIndex: 0,
			includeRaw: true,
		});

		expect(item.json.raw).toBe('OK|token');
	});
});

describe('toErrorItem', () => {
	it('describes a failed item without a task ID', () => {
		expect(
			toErrorItem(new UnsolvableError('Captcha could not be solved'), {
				captchaType: 'normal',
				itemIndex: 4,
			}),
		).toEqual({
			json: {
				error: 'Captcha could not be solved',
				errorType: 'UnsolvableError',
				captchaType: 'normal',
			},
			pairedItem: { item: 4 },
		});
	});

	it('keeps the task ID when the poll is what failed', () => {
		const item = toErrorItem(new UnsolvableError('nope'), {
			captchaType: 'normal',
			itemIndex: 1,
			taskId: '55',
		});

		expect(item.json.taskId).toBe('55');
	});
});
