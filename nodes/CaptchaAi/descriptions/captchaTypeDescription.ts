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
		noDataExpression: true,
		options: captchaTypeOptions,
		default: 'recaptcha_v2',
		description: 'Which kind of CAPTCHA to solve',
	},
];
