import { CaptchaAI } from 'captchaai-javascript';
import type { CaptchaAIConstructorOptions } from 'captchaai-javascript';

import { InputValidationError } from './errors';

export type { CaptchaAIConstructorOptions };
export type CaptchaAiClient = CaptchaAI;

/**
 * Normalises the key coming off the credential before the SDK sees it.
 *
 * Two things make this necessary. The SDK measures `apiKey.trim().length` but
 * sends the string untrimmed, so a key pasted with a stray space or newline
 * clears its length check and is then rejected by the API as "Key must be 32
 * characters" - for a key that is exactly 32 characters. And n8n's `required`
 * flag only tests for a non-empty string, so a key of nothing but spaces saves
 * and shows no issue on the credential.
 */
export function resolveApiKey(raw: unknown): string {
	const apiKey = typeof raw === 'string' ? raw.trim() : '';

	if (apiKey === '') {
		throw new InputValidationError(
			'The CaptchaAI API key is empty',
			"Open this node's credential and paste the 32-character key from your CaptchaAI dashboard.",
		);
	}

	return apiKey;
}

/**
 * Builds the SDK client for one node execution.
 *
 * The SDK constructor starts a background threadsInfo() call and stores the
 * promise without awaiting it. Awaiting it here both surfaces an unusable key
 * before any item is submitted and makes sure that promise is never left
 * unobserved, which would otherwise crash the n8n process on rejection.
 */
export async function createClient(options: CaptchaAIConstructorOptions): Promise<CaptchaAI> {
	const client = new CaptchaAI({ ...options, apiKey: resolveApiKey(options.apiKey) });
	await client.threadsInfo();
	return client;
}

export async function closeClient(client: CaptchaAI | undefined): Promise<void> {
	if (!client) return;
	try {
		await client.close();
	} catch {
		// Closing is best effort; the transport has no resources to leak.
	}
}
