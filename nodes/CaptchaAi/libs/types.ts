import type { ProxyType } from 'captchaai-javascript';

/**
 * Every CAPTCHA type name in the SDK's internal registry.
 *
 * The registry itself is not reachable through the package's public exports,
 * so this list is maintained here and pinned against the SDK by
 * `tests/registryParity.test.ts`.
 */
export const CAPTCHA_TYPE_NAMES = [
	'normal',
	'grid',
	'bls',
	'recaptcha_v2',
	'recaptcha_v2_invisible',
	'recaptcha_v2_enterprise',
	'recaptcha_v3',
	'recaptcha_v3_enterprise',
	'turnstile',
	'cloudflare_challenge',
	'geetest',
	'captchafox',
	'friendly_captcha',
	'lemin',
] as const;

export type CaptchaTypeName = (typeof CAPTCHA_TYPE_NAMES)[number];

export interface CaptchaTypeDef {
	/** Registry name passed to the SDK's send() and getResult(). */
	value: CaptchaTypeName;
	/** Label shown in the CAPTCHA Type dropdown. */
	name: string;
	/** Description shown next to the dropdown entry. */
	description: string;
	/** Types the API cannot solve without a proxy. */
	requiresProxy?: boolean;
}

/** Reads one node parameter for the item currently being solved. */
export type ParamReader = (name: string, fallback?: unknown) => unknown;

/** Optional Settings collection, read once per execution. */
export interface SolveSettings {
	maxPollSeconds?: number;
	maxRetries?: number;
	proxy?: string;
	proxyType?: ProxyType;
	includeRaw: boolean;
}

export type ExecutionMode = 'sequential' | 'parallel';

/** API parameters for one submit, keyed by the API's own field names. */
export type ApiParams = Record<string, unknown>;
