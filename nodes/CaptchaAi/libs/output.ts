import type { SolveResult } from 'captchaai-javascript';
import type { IDataObject, INodeExecutionData } from 'n8n-workflow';

import { errorType } from './errors';

export interface OutputOptions {
	captchaType: string;
	itemIndex: number;
	includeRaw: boolean;
}

/**
 * Shapes one solved CAPTCHA into an output item.
 *
 * The solution keeps whatever shape the CAPTCHA type produces: a token string
 * for reCAPTCHA and Turnstile, an object for GeeTest and Lemin, an array of
 * grid indices for Grid and BLS. Flattening it would lose information that
 * downstream nodes need.
 */
export function toOutputItem(result: SolveResult, options: OutputOptions): INodeExecutionData {
	const json: IDataObject = {
		captchaType: options.captchaType,
		taskId: result.taskId,
		solution: result.solution as IDataObject[keyof IDataObject],
	};

	if (result.userAgent) {
		json.userAgent = result.userAgent;
	}

	if (options.includeRaw) {
		json.raw = (result.raw ?? result.rawText ?? null) as IDataObject[keyof IDataObject];
	}

	return { json, pairedItem: { item: options.itemIndex } };
}

/** Shapes a failed item for output when Continue On Fail is enabled. */
export function toErrorItem(
	error: unknown,
	options: { captchaType: string; itemIndex: number; taskId?: string },
): INodeExecutionData {
	const json: IDataObject = {
		error: error instanceof Error ? error.message : String(error),
		errorType: errorType(error),
		captchaType: options.captchaType,
	};

	if (options.taskId) {
		json.taskId = options.taskId;
	}

	return { json, pairedItem: { item: options.itemIndex } };
}
