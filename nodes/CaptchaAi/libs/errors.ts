import {
	APIError,
	CaptchaAIError,
	InvalidKeyError,
	NetworkError,
	NoThreadsError,
	ProxyError,
	ThreadLimitError,
	TimeoutError,
	UnsolvableError,
	ValidationError,
} from 'captchaai-javascript';
import type { INode } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';

/** Raised by the node's own field validation, before the SDK is called. */
export class InputValidationError extends Error {
	description?: string;

	constructor(message: string, description?: string) {
		super(message);
		this.name = 'InputValidationError';
		this.description = description;
	}
}

export interface ErrorContext {
	itemIndex: number;
	captchaType: string;
	/** Present once send() has returned, so a failed poll stays traceable. */
	taskId?: string;
	/** Effective poll deadline, used in the timeout message. */
	maxPollSeconds?: number;
}

/** Stable machine-readable tag, also written into error output items. */
export function errorType(error: unknown): string {
	if (error instanceof InputValidationError) return 'InputValidationError';
	if (error instanceof CaptchaAIError) return error.constructor.name;
	if (error instanceof Error) return error.name || 'Error';
	return 'UnknownError';
}

function describe(error: unknown, context: ErrorContext): { message: string; description: string } {
	const { captchaType, maxPollSeconds } = context;
	const sdkMessage = error instanceof Error ? error.message : String(error);

	if (error instanceof InputValidationError) {
		return {
			message: sdkMessage,
			description: error.description ?? `Check the ${captchaType} fields on this node.`,
		};
	}

	if (error instanceof InvalidKeyError) {
		return {
			message: 'CaptchaAI rejected the API key',
			description: `${sdkMessage}. Open the node's credential and confirm the key is the 32-character key from your CaptchaAI dashboard.`,
		};
	}

	if (error instanceof ValidationError) {
		return {
			message: sdkMessage,
			description: `CaptchaAI rejected the parameters sent for the "${captchaType}" CAPTCHA type. Check the required fields for that type.`,
		};
	}

	if (error instanceof ProxyError) {
		return {
			message: 'The proxy was rejected or could not be reached',
			description: `${sdkMessage}. Check this node's Proxy and Proxy Type fields (shown directly on the node for CAPTCHA types that require one, or under Settings otherwise). The proxy must be reachable from the n8n instance.`,
		};
	}

	if (error instanceof ThreadLimitError) {
		return {
			message: 'All CaptchaAI threads on your account are busy',
			description: `${sdkMessage}. Lower Batch Size, switch Execution Mode to Sequential, or raise the thread limit on your CaptchaAI plan.`,
		};
	}

	if (error instanceof NoThreadsError) {
		return {
			message: 'Your CaptchaAI account has no active plan',
			description: `${sdkMessage}. Check your subscription in the CaptchaAI dashboard.`,
		};
	}

	if (error instanceof UnsolvableError) {
		return {
			message: 'CaptchaAI could not solve this CAPTCHA',
			description: `${sdkMessage}. This usually means the image was unreadable or the site key and page URL do not belong together. You are not charged for unsolved CAPTCHAs.`,
		};
	}

	if (error instanceof TimeoutError) {
		const deadline = maxPollSeconds ? `${maxPollSeconds} seconds` : 'the configured poll deadline';
		return {
			message: `CaptchaAI did not return a result within ${deadline}`,
			description: `${sdkMessage}. Raise Max Poll Time in this node's Settings if the CAPTCHA type is normally slow to solve.`,
		};
	}

	if (error instanceof NetworkError) {
		return {
			message: 'Could not reach the CaptchaAI API',
			description: `${sdkMessage}. Network failures are not retried automatically. Enable "Retry On Fail" on this node to retry the whole item.`,
		};
	}

	if (error instanceof APIError) {
		return {
			message: 'The CaptchaAI API returned an unexpected response',
			description: sdkMessage,
		};
	}

	return {
		message: sdkMessage || 'The CaptchaAI node failed for an unknown reason',
		description: `Unexpected error while solving a "${captchaType}" CAPTCHA.`,
	};
}

/**
 * Converts anything thrown while solving one item into a NodeOperationError
 * that names the item, the CAPTCHA type, and the task ID when one exists.
 */
export function toNodeError(
	node: INode,
	error: unknown,
	context: ErrorContext,
): NodeOperationError {
	const { message, description } = describe(error, context);
	const traceable = context.taskId
		? `${description} CaptchaAI task ID: ${context.taskId}.`
		: description;

	return new NodeOperationError(node, message, {
		itemIndex: context.itemIndex,
		description: traceable,
		type: errorType(error),
	});
}
