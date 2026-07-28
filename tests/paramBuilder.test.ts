import { describe, expect, it } from 'vitest';

import { CAPTCHA_TYPES } from '../nodes/CaptchaAi/config/captchaTypes';
import { InputValidationError } from '../nodes/CaptchaAi/libs/errors';
import { PARAM_BUILDERS, buildParams } from '../nodes/CaptchaAi/libs/paramBuilder';
import type { BuildContext } from '../nodes/CaptchaAi/libs/paramBuilder';
import type { CaptchaTypeName } from '../nodes/CaptchaAi/libs/types';

const PROXY = { proxy: 'user:pass@1.2.3.4:8080', proxyType: 'HTTP' as const };
const IMAGE = 'https://example.com/captcha.png';

function contextFrom(fields: Record<string, unknown>, settings = PROXY): BuildContext {
	return {
		read: (name, fallback) => (name in fields ? fields[name] : fallback),
		binaryPropertyNames: [],
		settings,
	};
}

/** Only the keys the SDK would actually send, mirroring params.normalise. */
function sent(params: Record<string, unknown>): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(params).filter(([, value]) => value !== undefined && value !== null),
	);
}

describe('buildParams', () => {
	it('has a builder for every catalog entry', () => {
		for (const type of CAPTCHA_TYPES) {
			expect(PARAM_BUILDERS[type.value]).toBeTypeOf('function');
		}
		expect(Object.keys(PARAM_BUILDERS).sort()).toEqual(
			CAPTCHA_TYPES.map((type) => type.value).sort(),
		);
	});

	it('maps the normal type, keeping caseSensitive in camelCase', () => {
		const params = buildParams(
			'normal',
			contextFrom({
				image: IMAGE,
				numeric: 1,
				minLength: 4,
				maxLength: 6,
				phrase: 1,
				caseSensitive: 1,
				lang: 'en',
				instructions: 'Type the characters',
			}),
		);

		expect(sent(params)).toEqual({
			image: IMAGE,
			numeric: 1,
			min_len: 4,
			max_len: 6,
			phrase: 1,
			caseSensitive: 1,
			lang: 'en',
			textinstructions: 'Type the characters',
		});
	});

	it('drops the zero value of the normal type enums', () => {
		const params = buildParams(
			'normal',
			contextFrom({ image: IMAGE, numeric: 0, phrase: 0, caseSensitive: 0 }),
		);
		expect(sent(params)).toEqual({ image: IMAGE });
	});

	it('hardcodes img_type for the grid type', () => {
		const params = buildParams(
			'grid',
			contextFrom({ image: IMAGE, instructions: 'Select all cars', gridSize: '3x3' }),
		);

		expect(sent(params)).toEqual({
			image: IMAGE,
			instructions: 'Select all cars',
			grid_size: '3x3',
			img_type: 'recaptcha',
		});
	});

	it('builds exactly nine BLS images in slot order', () => {
		const fields: Record<string, unknown> = { instructions: 'Pick the matching tiles' };
		for (let slot = 1; slot <= 9; slot += 1) {
			fields[`blsImage${slot}`] = `https://example.com/tile-${slot}.png`;
		}

		const params = buildParams('bls', contextFrom(fields));

		expect(params.images).toEqual([
			'https://example.com/tile-1.png',
			'https://example.com/tile-2.png',
			'https://example.com/tile-3.png',
			'https://example.com/tile-4.png',
			'https://example.com/tile-5.png',
			'https://example.com/tile-6.png',
			'https://example.com/tile-7.png',
			'https://example.com/tile-8.png',
			'https://example.com/tile-9.png',
		]);
		expect(params.instructions).toBe('Pick the matching tiles');
	});

	it('rejects a BLS slot that is left empty', () => {
		const fields: Record<string, unknown> = { instructions: 'Pick the matching tiles' };
		for (let slot = 1; slot <= 8; slot += 1) {
			fields[`blsImage${slot}`] = IMAGE;
		}

		expect(() => buildParams('bls', contextFrom(fields))).toThrow(InputValidationError);
		expect(() => buildParams('bls', contextFrom(fields))).toThrow(/Image 9/);
	});

	it('distinguishes the three reCAPTCHA v2 variants by flag', () => {
		const fields = { siteKey: 'key', pageUrl: 'https://example.com' };

		expect(sent(buildParams('recaptcha_v2', contextFrom(fields)))).toEqual({
			googlekey: 'key',
			pageurl: 'https://example.com',
		});
		expect(sent(buildParams('recaptcha_v2_invisible', contextFrom(fields)))).toEqual({
			googlekey: 'key',
			pageurl: 'https://example.com',
			invisible: 1,
		});
		expect(sent(buildParams('recaptcha_v2_enterprise', contextFrom(fields)))).toEqual({
			googlekey: 'key',
			pageurl: 'https://example.com',
			enterprise: 1,
		});
	});

	it('sends version v3 and the enterprise flag for the v3 variants', () => {
		const fields = {
			siteKey: 'key',
			pageUrl: 'https://example.com',
			action: 'login',
			minScore: 0.7,
		};

		expect(sent(buildParams('recaptcha_v3', contextFrom(fields)))).toEqual({
			googlekey: 'key',
			pageurl: 'https://example.com',
			version: 'v3',
			action: 'login',
			min_score: 0.7,
		});
		expect(sent(buildParams('recaptcha_v3_enterprise', contextFrom(fields)))).toEqual({
			googlekey: 'key',
			pageurl: 'https://example.com',
			version: 'v3',
			enterprise: 1,
			action: 'login',
			min_score: 0.7,
		});
	});

	it('requires an action for reCAPTCHA v3', () => {
		expect(() =>
			buildParams('recaptcha_v3', contextFrom({ siteKey: 'key', pageUrl: 'https://example.com' })),
		).toThrow(/Action is required/);
	});

	it('passes cookies and user agent through for browser types', () => {
		const params = buildParams(
			'turnstile',
			contextFrom({
				siteKey: 'key',
				pageUrl: 'https://example.com',
				cookies: 'a=1',
				userAgent: 'Mozilla/5.0',
			}),
		);

		expect(sent(params)).toEqual({
			sitekey: 'key',
			pageurl: 'https://example.com',
			cookies: 'a=1',
			user_agent: 'Mozilla/5.0',
		});
	});

	it('maps geetest, friendly captcha, and lemin field names', () => {
		expect(
			sent(
				buildParams(
					'geetest',
					contextFrom({ gt: 'gt-value', challenge: 'ch', pageUrl: 'https://example.com' }),
				),
			),
		).toEqual({ gt: 'gt-value', challenge: 'ch', pageurl: 'https://example.com' });

		expect(
			sent(
				buildParams(
					'friendly_captcha',
					contextFrom({ siteKey: 'key', pageUrl: 'https://example.com', version: 'v2' }),
				),
			),
		).toEqual({ sitekey: 'key', pageurl: 'https://example.com', version: 'v2' });

		expect(
			sent(
				buildParams(
					'lemin',
					contextFrom({
						captchaId: 'cap',
						divId: 'div',
						pageUrl: 'https://example.com',
						apiServer: 'https://api.leminnow.com',
					}),
				),
			),
		).toEqual({
			captcha_id: 'cap',
			div_id: 'div',
			pageurl: 'https://example.com',
			api_server: 'https://api.leminnow.com',
		});
	});

	it.each([
		['no settings at all', undefined],
		['a proxy with no proxy type', { proxy: 'user:pass@1.2.3.4:8080' }],
		['a proxy type with no proxy', { proxyType: 'HTTP' as const }],
	])('names the Settings fields when a proxy-only type has %s', (_label, settings) => {
		const context: BuildContext = {
			read: (name, fallback) => (name === 'pageUrl' ? 'https://example.com' : fallback),
			settings,
		};

		expect(() => buildParams('cloudflare_challenge', context)).toThrow(InputValidationError);
		expect(() => buildParams('cloudflare_challenge', context)).toThrow(/requires a proxy/);
	});

	it('allows a proxy-only type once both proxy fields are set', () => {
		const context = contextFrom({ pageUrl: 'https://example.com' });
		expect(() => buildParams('cloudflare_challenge', context)).not.toThrow();
		expect(() => buildParams('captchafox', contextFrom({ siteKey: 'k', pageUrl: 'https://e.com' })))
			.not.toThrow();
	});

	it('rejects a file path in an image field before the SDK is reached', () => {
		expect(() => buildParams('normal', contextFrom({ image: '/etc/passwd' }))).toThrow(
			/file path/,
		);
	});

	it('covers every registry type', () => {
		const covered = Object.keys(PARAM_BUILDERS) as CaptchaTypeName[];
		expect(covered).toHaveLength(14);
	});
});
