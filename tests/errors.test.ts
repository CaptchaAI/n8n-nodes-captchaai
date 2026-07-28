import {
	APIError,
	InvalidKeyError,
	NetworkError,
	NoThreadsError,
	ProxyError,
	ThreadLimitError,
	TimeoutError,
	UnsolvableError,
	ValidationError,
} from 'captchaai-javascript';
import type { INode } from 'n8n-workflow';
import { describe, expect, it } from 'vitest';

import { InputValidationError, errorType, toNodeError } from '../nodes/CaptchaAi/libs/errors';

const node = {
	id: 'test-node',
	name: 'CaptchaAI',
	type: 'n8n-nodes-captchaai.captchaAi',
	typeVersion: 1,
	position: [0, 0],
	parameters: {},
} as unknown as INode;

const context = { itemIndex: 3, captchaType: 'recaptcha_v2' };

describe('errorType', () => {
	it.each([
		[new InvalidKeyError('x'), 'InvalidKeyError'],
		[new ValidationError('x'), 'ValidationError'],
		[new ProxyError('x'), 'ProxyError'],
		[new ThreadLimitError('x'), 'ThreadLimitError'],
		[new NoThreadsError('x'), 'NoThreadsError'],
		[new UnsolvableError('x'), 'UnsolvableError'],
		[new TimeoutError('x'), 'TimeoutError'],
		[new NetworkError('x'), 'NetworkError'],
		[new APIError('x'), 'APIError'],
		[new InputValidationError('x'), 'InputValidationError'],
	])('tags %s', (error, expected) => {
		expect(errorType(error)).toBe(expected);
	});

	it('falls back for a non-Error value', () => {
		expect(errorType('boom')).toBe('UnknownError');
	});
});

describe('toNodeError', () => {
	it('gives each SDK error class its own message', () => {
		const messages = [
			new InvalidKeyError('Key not found'),
			new ValidationError('pageurl is missing or invalid'),
			new ProxyError('Proxy was marked bad'),
			new ThreadLimitError('All account threads are busy'),
			new NoThreadsError('Account expired'),
			new UnsolvableError('Captcha could not be solved'),
			new TimeoutError('Poll deadline exceeded'),
			new NetworkError('Network disconnected'),
			new APIError('Unexpected submit error'),
		].map((error) => toNodeError(node, error, context).message);

		expect(new Set(messages).size).toBe(messages.length);
	});

	it('carries the item index and the error type', () => {
		const error = toNodeError(node, new UnsolvableError('nope'), context);
		expect(error.context.itemIndex).toBe(3);
		expect(error.type).toBe('UnsolvableError');
	});

	it('re-attaches the task ID when send() already returned one', () => {
		const error = toNodeError(node, new TimeoutError('Poll deadline exceeded'), {
			...context,
			taskId: '77123456',
			maxPollSeconds: 180,
		});

		expect(error.description).toContain('77123456');
		expect(error.message).toContain('180 seconds');
	});

	it('omits the task ID when the submit itself failed', () => {
		const error = toNodeError(node, new ValidationError('googlekey is malformed'), context);
		expect(error.description).not.toContain('task ID');
	});

	it('points an invalid key at the credential', () => {
		const error = toNodeError(node, new InvalidKeyError('Key must be 32 characters'), context);
		expect(error.message).toContain('rejected the API key');
		expect(error.description).toContain('32-character key');
	});

	it('suggests lowering Batch Size when threads are exhausted', () => {
		const error = toNodeError(node, new ThreadLimitError('All account threads are busy'), context);
		expect(error.description).toContain('Batch Size');
	});

	it('states plainly that network errors are not retried', () => {
		const error = toNodeError(node, new NetworkError('Network disconnected'), context);
		expect(error.description).toContain('not retried');
		expect(error.description).toContain('Retry On Fail');
	});

	it('points proxy failures at Settings', () => {
		const error = toNodeError(node, new ProxyError('Proxy connection failed'), context);
		expect(error.description).toContain('Proxy Type');
	});

	it('passes an SDK validation message through unchanged', () => {
		const error = toNodeError(node, new ValidationError('pageurl is missing or invalid'), context);
		expect(error.message).toBe('pageurl is missing or invalid');
		expect(error.description).toContain('recaptcha_v2');
	});

	it('uses the description supplied with an input validation error', () => {
		const error = toNodeError(
			node,
			new InputValidationError('Site Key is required', 'Fill in the Site Key field'),
			context,
		);
		expect(error.message).toBe('Site Key is required');
		expect(error.description).toContain('Fill in the Site Key field');
	});

	it('wraps an unrecognised error without losing its message', () => {
		const error = toNodeError(node, new Error('something odd'), context);
		expect(error.message).toBe('something odd');
		expect(error.type).toBe('Error');
	});
});
