import { requiresProxy } from '../config/captchaTypes';
import { InputValidationError } from './errors';
import { describeImageProblem, validateImageInput } from './imageInput';
import type { ApiParams, CaptchaTypeName, ParamReader, SolveSettings } from './types';

export interface BuildContext {
	/** Reads a node parameter for the item being solved. */
	read: ParamReader;
	/** Binary property names on the input item, used for friendlier errors. */
	binaryPropertyNames?: string[];
	/** Execution-level settings, needed for the proxy precheck. */
	settings?: Pick<SolveSettings, 'proxy' | 'proxyType'>;
}

const BLS_IMAGE_COUNT = 9;

function text(context: BuildContext, name: string): string | undefined {
	const value = context.read(name, '');
	if (typeof value !== 'string') return undefined;
	const trimmed = value.trim();
	return trimmed === '' ? undefined : trimmed;
}

function requiredText(context: BuildContext, name: string, label: string): string {
	const value = text(context, name);
	if (value === undefined) {
		throw new InputValidationError(
			`${label} is required`,
			`Fill in the ${label} field on the CaptchaAI node.`,
		);
	}
	return value;
}

function num(context: BuildContext, name: string): number | undefined {
	const value = context.read(name, undefined);
	if (value === undefined || value === null || value === '') return undefined;
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Reads a number whose zero value means "not specified" in the UI.
 *
 * Zero is the API's own default for each of these, so dropping it and sending
 * it explicitly are equivalent - dropping just keeps the request minimal.
 */
function dropZero(context: BuildContext, name: string): number | undefined {
	const value = num(context, name);
	return value === undefined || value === 0 ? undefined : value;
}

function image(context: BuildContext, name: string, label: string): string {
	const result = validateImageInput(context.read(name, ''), context.binaryPropertyNames ?? []);
	if (result.problem) {
		throw new InputValidationError(
			describeImageProblem(result.problem, label),
			'This node accepts an image URL, a data URI, or a base64 string.',
		);
	}
	return result.value as string;
}

/** Cookies and User Agent, shared by every browser-based CAPTCHA type. */
function browserOptions(context: BuildContext): ApiParams {
	return {
		cookies: text(context, 'cookies'),
		user_agent: text(context, 'userAgent'),
	};
}

type Builder = (context: BuildContext) => ApiParams;

/**
 * Maps the node's UI fields onto the exact API parameter names the SDK's own
 * convenience methods build. The node calls send() rather than those methods,
 * so it has to produce the same shape itself.
 *
 * Undefined values are left in place: the SDK's params.normalise drops them
 * before the request is sent.
 */
export const PARAM_BUILDERS: Record<CaptchaTypeName, Builder> = {
	normal: (context) => ({
		image: image(context, 'image', 'Image'),
		numeric: dropZero(context, 'numeric'),
		min_len: dropZero(context, 'minLength'),
		max_len: dropZero(context, 'maxLength'),
		phrase: dropZero(context, 'phrase'),
		// Deliberately camelCase: this is the name the API expects.
		caseSensitive: dropZero(context, 'caseSensitive'),
		lang: text(context, 'lang'),
		textinstructions: text(context, 'instructions'),
	}),

	grid: (context) => ({
		image: image(context, 'image', 'Image'),
		instructions: requiredText(context, 'instructions', 'Instructions'),
		grid_size: requiredText(context, 'gridSize', 'Grid Size'),
		img_type: 'recaptcha',
	}),

	bls: (context) => ({
		images: Array.from({ length: BLS_IMAGE_COUNT }, (_unused, index) =>
			image(context, `blsImage${index + 1}`, `Image ${index + 1}`),
		),
		instructions: requiredText(context, 'instructions', 'Instructions'),
	}),

	recaptcha_v2: (context) => ({
		googlekey: requiredText(context, 'siteKey', 'Site Key'),
		pageurl: requiredText(context, 'pageUrl', 'Page URL'),
		action: text(context, 'action'),
		...browserOptions(context),
	}),

	recaptcha_v2_invisible: (context) => ({
		googlekey: requiredText(context, 'siteKey', 'Site Key'),
		pageurl: requiredText(context, 'pageUrl', 'Page URL'),
		invisible: 1,
		action: text(context, 'action'),
		...browserOptions(context),
	}),

	recaptcha_v2_enterprise: (context) => ({
		googlekey: requiredText(context, 'siteKey', 'Site Key'),
		pageurl: requiredText(context, 'pageUrl', 'Page URL'),
		enterprise: 1,
		action: text(context, 'action'),
		...browserOptions(context),
	}),

	recaptcha_v3: (context) => ({
		googlekey: requiredText(context, 'siteKey', 'Site Key'),
		pageurl: requiredText(context, 'pageUrl', 'Page URL'),
		version: 'v3',
		action: requiredText(context, 'action', 'Action'),
		min_score: dropZero(context, 'minScore'),
		...browserOptions(context),
	}),

	recaptcha_v3_enterprise: (context) => ({
		googlekey: requiredText(context, 'siteKey', 'Site Key'),
		pageurl: requiredText(context, 'pageUrl', 'Page URL'),
		version: 'v3',
		enterprise: 1,
		action: requiredText(context, 'action', 'Action'),
		min_score: dropZero(context, 'minScore'),
		...browserOptions(context),
	}),

	turnstile: (context) => ({
		sitekey: requiredText(context, 'siteKey', 'Site Key'),
		pageurl: requiredText(context, 'pageUrl', 'Page URL'),
		...browserOptions(context),
	}),

	cloudflare_challenge: (context) => ({
		pageurl: requiredText(context, 'pageUrl', 'Page URL'),
		...browserOptions(context),
	}),

	geetest: (context) => ({
		gt: requiredText(context, 'gt', 'GT'),
		challenge: requiredText(context, 'challenge', 'Challenge'),
		pageurl: requiredText(context, 'pageUrl', 'Page URL'),
		...browserOptions(context),
	}),

	captchafox: (context) => ({
		sitekey: requiredText(context, 'siteKey', 'Site Key'),
		pageurl: requiredText(context, 'pageUrl', 'Page URL'),
		...browserOptions(context),
	}),

	friendly_captcha: (context) => ({
		sitekey: requiredText(context, 'siteKey', 'Site Key'),
		pageurl: requiredText(context, 'pageUrl', 'Page URL'),
		version: text(context, 'version'),
	}),

	lemin: (context) => ({
		captcha_id: requiredText(context, 'captchaId', 'Captcha ID'),
		div_id: requiredText(context, 'divId', 'Div ID'),
		pageurl: requiredText(context, 'pageUrl', 'Page URL'),
		api_server: text(context, 'apiServer'),
	}),
};

/**
 * Builds the submit parameters for one item.
 *
 * The proxy precheck runs here so proxy-only types fail with a message that
 * names the node's own Settings fields, instead of the SDK's generic
 * ValidationError about a missing proxy config.
 */
export function buildParams(captchaType: CaptchaTypeName, context: BuildContext): ApiParams {
	const builder = PARAM_BUILDERS[captchaType];
	if (!builder) {
		throw new InputValidationError(
			`Unsupported CAPTCHA type "${captchaType}"`,
			'Pick a type from the CAPTCHA Type field or pass a supported registry name from an expression.',
		);
	}

	if (requiresProxy(captchaType)) {
		const { proxy, proxyType } = context.settings ?? {};
		if (!proxy || !proxyType) {
			throw new InputValidationError(
				`The "${captchaType}" CAPTCHA type requires a proxy`,
				'Open Settings on this node and fill in both Proxy and Proxy Type. CaptchaAI cannot solve this type without one.',
			);
		}
	}

	return builder(context);
}
