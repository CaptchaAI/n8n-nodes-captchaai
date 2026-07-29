import type { INodeProperties } from 'n8n-workflow';

import { captchaTypeOptions } from '../config/captchaTypes';

/**
 * The one dropdown that drives the whole node. Every other field is shown or
 * hidden based on the value picked here.
 */
export const captchaTypeDescription: INodeProperties[] = [
	{
		displayName: 'CAPTCHA Type',
		name: 'captchaType',
		type: 'options',
		options: captchaTypeOptions,
		default: 'recaptcha_v2',
		description:
			'Which kind of CAPTCHA to solve. Use an expression (for example {{ $json.captchaType }}) to take the registry name from a previous node. Supported values are the option values, such as recaptcha_v2 or turnstile.',
	},
];
