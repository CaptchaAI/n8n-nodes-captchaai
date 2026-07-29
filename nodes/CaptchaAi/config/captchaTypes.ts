import type { INodePropertyOptions } from 'n8n-workflow';

import { InputValidationError } from '../libs/errors';
import type { CaptchaTypeDef, CaptchaTypeName } from '../libs/types';

/**
 * The flat CAPTCHA Type catalog behind the node's single dropdown.
 *
 * Order here is the order shown in the UI. The five reCAPTCHA variants are
 * listed separately rather than as flags, because the SDK resolves an
 * enterprise flag ahead of an invisible one and has no combined registry
 * entry - separate options remove that ambiguity entirely.
 */
export const CAPTCHA_TYPES: CaptchaTypeDef[] = [
	{
		value: 'normal',
		name: 'Image (Normal)',
		description: 'Read the characters out of a distorted image',
	},
	{
		value: 'grid',
		name: 'Grid',
		description: 'Pick the matching tiles in a 3x3 or 4x4 image grid',
	},
	{
		value: 'bls',
		name: 'BLS',
		description: 'Solve a BLS challenge built from exactly nine images',
	},
	{
		value: 'recaptcha_v2',
		name: 'reCAPTCHA V2',
		description: 'Standard "I am not a robot" checkbox widget',
	},
	{
		value: 'recaptcha_v2_invisible',
		name: 'reCAPTCHA V2 Invisible',
		description: 'ReCAPTCHA v2 with no visible checkbox',
	},
	{
		value: 'recaptcha_v2_enterprise',
		name: 'reCAPTCHA V2 Enterprise',
		description: 'Enterprise reCAPTCHA v2. The result includes a user agent to reuse.',
	},
	{
		value: 'recaptcha_v3',
		name: 'reCAPTCHA V3',
		description: 'Score-based reCAPTCHA v3, which needs an action name',
	},
	{
		value: 'recaptcha_v3_enterprise',
		name: 'reCAPTCHA V3 Enterprise',
		description: 'Enterprise reCAPTCHA v3. The result includes a user agent to reuse.',
	},
	{
		value: 'turnstile',
		name: 'Cloudflare Turnstile',
		description: 'Cloudflare Turnstile widget',
	},
	{
		value: 'cloudflare_challenge',
		name: 'Cloudflare Challenge',
		description: 'Cloudflare interstitial challenge page. Requires a proxy.',
		requiresProxy: true,
	},
	{
		value: 'geetest',
		name: 'GeeTest',
		description: 'GeeTest v3 slider. Returns challenge, validate, and seccode.',
	},
	{
		value: 'captchafox',
		name: 'CaptchaFox',
		description: 'CaptchaFox slider challenge. Requires a proxy.',
		requiresProxy: true,
	},
	{
		value: 'friendly_captcha',
		name: 'Friendly Captcha',
		description: 'Friendly Captcha proof-of-work challenge',
	},
	{
		value: 'lemin',
		name: 'Lemin',
		description: 'Lemin puzzle. Returns an answer and a challenge UUID.',
	},
];

const BY_VALUE = new Map<string, CaptchaTypeDef>(CAPTCHA_TYPES.map((type) => [type.value, type]));

export const captchaTypeOptions: INodePropertyOptions[] = CAPTCHA_TYPES.map((type) => ({
	name: type.name,
	value: type.value,
	description: type.description,
}));

export function getCaptchaType(value: string): CaptchaTypeDef | undefined {
	return BY_VALUE.get(value);
}

/**
 * Normalises a CAPTCHA Type parameter value from the UI or an expression.
 *
 * Expressions resolve to the registry name (recaptcha_v2, turnstile, …), not
 * the human-readable label shown in the dropdown.
 */
export function resolveCaptchaType(value: unknown): CaptchaTypeName {
	const raw = typeof value === 'string' ? value.trim() : '';

	if (raw === '') {
		throw new InputValidationError(
			'CAPTCHA Type is required',
			'Pick a type in the dropdown or set an expression that returns a supported registry name, for example {{ $json.captchaType }}.',
		);
	}

	if (!BY_VALUE.has(raw)) {
		throw new InputValidationError(
			`Unsupported CAPTCHA type "${raw}"`,
			'Use one of the CAPTCHA Type option values (recaptcha_v2, turnstile, normal, …). Labels such as "reCAPTCHA V2" are not accepted.',
		);
	}

	return raw as CaptchaTypeName;
}

export function requiresProxy(value: string): boolean {
	return BY_VALUE.get(value)?.requiresProxy === true;
}

/** Types whose submit parameters include an image. */
export const IMAGE_TYPES: CaptchaTypeName[] = ['normal', 'grid', 'bls'];
