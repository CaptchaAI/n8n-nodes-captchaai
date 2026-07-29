import { describe, expect, it } from 'vitest';

import { resolveCaptchaType } from '../nodes/CaptchaAi/config/captchaTypes';
import { InputValidationError } from '../nodes/CaptchaAi/libs/errors';

describe('resolveCaptchaType', () => {
	it('accepts registry names with surrounding whitespace', () => {
		expect(resolveCaptchaType('  turnstile  ')).toBe('turnstile');
	});

	it('rejects display labels', () => {
		expect(() => resolveCaptchaType('reCAPTCHA V2')).toThrow(InputValidationError);
	});

	it('rejects empty values', () => {
		expect(() => resolveCaptchaType('   ')).toThrow(InputValidationError);
	});
});
