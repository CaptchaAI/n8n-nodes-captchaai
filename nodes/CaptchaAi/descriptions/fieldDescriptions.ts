import type { IDisplayOptions, INodeProperties } from 'n8n-workflow';

import type { CaptchaTypeName } from '../libs/types';

/** Every type whose challenge is rendered in a browser page. */
const BROWSER_TYPES: CaptchaTypeName[] = [
	'recaptcha_v2',
	'recaptcha_v2_invisible',
	'recaptcha_v2_enterprise',
	'recaptcha_v3',
	'recaptcha_v3_enterprise',
	'turnstile',
	'cloudflare_challenge',
	'geetest',
	'captchafox',
];

const RECAPTCHA_V2_TYPES: CaptchaTypeName[] = [
	'recaptcha_v2',
	'recaptcha_v2_invisible',
	'recaptcha_v2_enterprise',
];

const RECAPTCHA_V3_TYPES: CaptchaTypeName[] = ['recaptcha_v3', 'recaptcha_v3_enterprise'];

const SITE_KEY_TYPES: CaptchaTypeName[] = [
	...RECAPTCHA_V2_TYPES,
	...RECAPTCHA_V3_TYPES,
	'turnstile',
	'captchafox',
	'friendly_captcha',
];

const PAGE_URL_TYPES: CaptchaTypeName[] = [
	...RECAPTCHA_V2_TYPES,
	...RECAPTCHA_V3_TYPES,
	'turnstile',
	'cloudflare_challenge',
	'geetest',
	'captchafox',
	'friendly_captcha',
	'lemin',
];

function shownFor(...captchaType: CaptchaTypeName[]): IDisplayOptions {
	return { show: { captchaType } };
}

/**
 * The nine BLS grid cells, all required, in reading order.
 *
 * Descriptions are assembled with concatenation rather than template literals
 * because eslint-plugin-n8n-nodes-base's description autofixes rewrite
 * interpolated descriptions into literal text and destroy the placeholders.
 */
const blsImageFields: INodeProperties[] = Array.from({ length: 9 }, (_unused, index) => ({
	displayName: 'Image ' + String(index + 1),
	name: 'blsImage' + String(index + 1),
	type: 'string' as const,
	default: '',
	required: true,
	placeholder: 'https://example.com/tile.png',
	description:
		'Image for grid cell ' +
		String(index + 1) +
		' of 9. Accepts an image URL, a data URI, or a base64 string. File paths and binary attachments are not supported. PNG and GIF images must be at most 1000px per side.',
	displayOptions: shownFor('bls'),
}));

export const fieldDescriptions: INodeProperties[] = [
	// ----- Image types -------------------------------------------------------
	{
		displayName: 'Image',
		name: 'image',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'https://example.com/captcha.png',
		description:
			'The CAPTCHA image to solve. Accepts an image URL, a data URI, or a base64 string. File paths and binary attachments are not supported. PNG and GIF images must be at most 1000px per side.',
		displayOptions: shownFor('normal', 'grid'),
	},
	...blsImageFields,
	{
		displayName: 'Instructions',
		name: 'instructions',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'Select all images with traffic lights',
		description: 'What the solver should do with the image, in English',
		displayOptions: shownFor('grid', 'bls'),
	},
	{
		displayName: 'Grid Size',
		name: 'gridSize',
		type: 'options',
		default: '3x3',
		required: true,
		options: [
			{ name: '3x3', value: '3x3' },
			{ name: '4x4', value: '4x4' },
		],
		description: 'Layout of the image grid',
		displayOptions: shownFor('grid'),
	},

	// ----- Site key and page URL --------------------------------------------
	{
		displayName: 'Site Key',
		name: 'siteKey',
		type: 'string',
		default: '',
		required: true,
		placeholder: '6Le-wvkSAAAAAPBMRTvw0Q4Muexq9bi0DJwx_mJ-',
		description: 'The CAPTCHA site key taken from the target page HTML',
		displayOptions: { show: { captchaType: SITE_KEY_TYPES } },
	},
	{
		displayName: 'Page URL',
		name: 'pageUrl',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'https://example.com/login',
		description: 'Full URL of the page the CAPTCHA appears on',
		displayOptions: { show: { captchaType: PAGE_URL_TYPES } },
	},

	// ----- GeeTest -----------------------------------------------------------
	{
		displayName: 'GT',
		name: 'gt',
		type: 'string',
		default: '',
		required: true,
		description: 'The GeeTest "gt" value from the target page',
		displayOptions: shownFor('geetest'),
	},
	{
		displayName: 'Challenge',
		name: 'challenge',
		type: 'string',
		default: '',
		required: true,
		description: 'The GeeTest "challenge" value. It is single use, so fetch a fresh one for every solve.',
		displayOptions: shownFor('geetest'),
	},

	// ----- Lemin -------------------------------------------------------------
	{
		displayName: 'Captcha ID',
		name: 'captchaId',
		type: 'string',
		default: '',
		required: true,
		description: 'The Lemin captcha ID from the target page',
		displayOptions: shownFor('lemin'),
	},
	{
		displayName: 'Div ID',
		name: 'divId',
		type: 'string',
		default: '',
		required: true,
		description: 'ID of the HTML element the Lemin widget is rendered into',
		displayOptions: shownFor('lemin'),
	},

	// ----- reCAPTCHA v3 action (required) ------------------------------------
	{
		displayName: 'Action',
		name: 'action',
		type: 'string',
		default: '',
		required: true,
		placeholder: 'login',
		description: 'The reCAPTCHA v3 action name used by the page, for example "login"',
		displayOptions: { show: { captchaType: RECAPTCHA_V3_TYPES } },
	},

	// ----- Optional, image types ---------------------------------------------
	{
		displayName: 'Instructions',
		name: 'instructions',
		type: 'string',
		default: '',
		placeholder: 'Enter the text you see',
		description: 'Optional hint for the solver, in English',
		displayOptions: shownFor('normal'),
	},
	{
		displayName: 'Character Set',
		name: 'numeric',
		type: 'options',
		default: 0,
		options: [
			{ name: 'Not Specified', value: 0 },
			{ name: 'Digits Only', value: 1 },
			{ name: 'Letters Only', value: 2 },
			{ name: 'Digits or Letters', value: 3 },
			{ name: 'Digits and Letters', value: 4 },
		],
		description: 'Restrict what the answer may contain',
		displayOptions: shownFor('normal'),
	},
	{
		displayName: 'Min Length',
		name: 'minLength',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 0 },
		description: 'Shortest acceptable answer. Leave at 0 for no minimum.',
		displayOptions: shownFor('normal'),
	},
	{
		displayName: 'Max Length',
		name: 'maxLength',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 0 },
		description: 'Longest acceptable answer. Leave at 0 for no maximum.',
		displayOptions: shownFor('normal'),
	},
	{
		displayName: 'Word Count',
		name: 'phrase',
		type: 'options',
		default: '',
		options: [
			{ name: 'Not Specified', value: '' },
			{ name: 'Single Word', value: '0' },
			{ name: 'Multiple Words', value: '1' },
		],
		description: 'Whether the answer is one word or several',
		displayOptions: shownFor('normal'),
	},
	{
		displayName: 'Case Sensitivity',
		name: 'caseSensitive',
		type: 'options',
		default: '',
		options: [
			{ name: 'Not Specified', value: '' },
			{ name: 'Case Insensitive', value: '0' },
			{ name: 'Case Sensitive', value: '1' },
		],
		description: 'Whether upper and lower case matter in the answer',
		displayOptions: shownFor('normal'),
	},
	{
		displayName: 'Language',
		name: 'lang',
		type: 'string',
		default: '',
		placeholder: 'en',
		description: 'Two-letter language code of the text in the image, for example "en" or "de"',
		displayOptions: shownFor('normal'),
	},

	// ----- Optional, reCAPTCHA ------------------------------------------------
	{
		displayName: 'Action',
		name: 'action',
		type: 'string',
		default: '',
		placeholder: 'verify',
		description: 'The action name the page passes to reCAPTCHA, if it sets one',
		displayOptions: { show: { captchaType: RECAPTCHA_V2_TYPES } },
	},
	{
		displayName: 'Min Score',
		name: 'minScore',
		type: 'number',
		default: 0,
		typeOptions: { minValue: 0, maxValue: 1, numberPrecision: 1 },
		description:
			'Lowest acceptable reCAPTCHA v3 score, from 0 to 1. Leave at 0 to let CaptchaAI decide. Higher scores cost more and take longer',
		displayOptions: { show: { captchaType: RECAPTCHA_V3_TYPES } },
	},

	// ----- Optional, Friendly Captcha and Lemin -------------------------------
	{
		displayName: 'Version',
		name: 'version',
		type: 'options',
		default: '',
		options: [
			{ name: 'Automatic', value: '' },
			{ name: 'V1', value: 'v1' },
			{ name: 'V2', value: 'v2' },
		],
		description: 'Which Friendly Captcha version the page uses',
		displayOptions: shownFor('friendly_captcha'),
	},
	{
		displayName: 'API Server',
		name: 'apiServer',
		type: 'string',
		default: '',
		placeholder: 'https://api.leminnow.com',
		description: 'Override the Lemin API server, if the page uses a custom one',
		displayOptions: shownFor('lemin'),
	},

	// ----- Optional, browser types --------------------------------------------
	{
		displayName: 'Cookies',
		name: 'cookies',
		type: 'string',
		default: '',
		placeholder: 'name1=value1; name2=value2',
		description: 'Cookies to send with the solve, as a single header-style string',
		displayOptions: { show: { captchaType: BROWSER_TYPES } },
	},
	{
		displayName: 'User Agent',
		name: 'userAgent',
		type: 'string',
		default: '',
		placeholder: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
		description: 'User agent to solve with. Use the same one for the follow-up request.',
		displayOptions: { show: { captchaType: BROWSER_TYPES } },
	},
];
