/**
 * Validation for the node's image fields.
 *
 * The node accepts an http(s) URL, a data URI, or a raw base64 string, and
 * nothing else. In particular a bare string that looks like a path is rejected
 * rather than passed through: a workflow must never be able to make the n8n
 * server read a file off its own disk.
 */

const DATA_URI = /^data:[^;,]*(;[^,]*)*,/i;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export type ImageInputProblem =
	| { kind: 'empty' }
	| { kind: 'binary'; binaryProperty: string }
	| { kind: 'object' }
	| { kind: 'path'; value: string }
	| { kind: 'unsupported'; value: string };

export interface ImageValidationResult {
	value?: string;
	problem?: ImageInputProblem;
}

function looksLikePath(value: string): boolean {
	if (value.startsWith('file://')) return true;
	// POSIX absolute or explicitly relative.
	if (value.startsWith('/') || value.startsWith('./') || value.startsWith('../')) return true;
	// Windows drive letter or UNC share.
	if (/^[A-Za-z]:[\\/]/.test(value) || value.startsWith('\\\\')) return true;
	// A bare filename with an image-ish extension, e.g. captcha.png.
	if (/^[^\s/\\:*?"<>|]+\.(png|jpe?g|gif|bmp|webp|tiff?)$/i.test(value)) return true;
	// Any remaining backslash-separated segment list, e.g. images\captcha.png.
	if (value.includes('\\') && !value.includes(' ')) return true;
	return false;
}

/**
 * Classifies one raw image field value.
 *
 * `binaryPropertyNames` are the binary properties present on the input item,
 * used only to produce a better message when the field was left empty because
 * the user expected an attached file to be picked up.
 */
export function validateImageInput(
	raw: unknown,
	binaryPropertyNames: string[] = [],
): ImageValidationResult {
	if (raw !== null && typeof raw === 'object') {
		const [binaryProperty] = binaryPropertyNames;
		return {
			problem: binaryProperty ? { kind: 'binary', binaryProperty } : { kind: 'object' },
		};
	}

	const value = typeof raw === 'string' ? raw.trim() : '';

	if (value === '') {
		const [binaryProperty] = binaryPropertyNames;
		return { problem: binaryProperty ? { kind: 'binary', binaryProperty } : { kind: 'empty' } };
	}

	if (value.startsWith('http://') || value.startsWith('https://')) {
		return { value };
	}

	if (DATA_URI.test(value)) {
		return { value };
	}

	// Base64 payloads are often line-wrapped when pasted or read from a file.
	// Check before path heuristics: JPEG data often begins with "/9j/" which
	// would otherwise match looksLikePath's leading-slash rule.
	const compact = value.replace(/\s+/g, '');
	if (compact.length > 0 && compact.length % 4 === 0 && BASE64.test(compact)) {
		return { value: compact };
	}

	if (looksLikePath(value)) {
		return { problem: { kind: 'path', value } };
	}

	return { problem: { kind: 'unsupported', value } };
}

/** Human-readable message for a rejected image field. */
export function describeImageProblem(problem: ImageInputProblem, fieldLabel: string): string {
	switch (problem.kind) {
		case 'empty':
			return `${fieldLabel} is empty. Provide an image URL, a data URI, or a base64 string.`;
		case 'binary':
			return `${fieldLabel} is empty, but this item has binary data in the "${problem.binaryProperty}" property. This node does not read binary attachments: convert it first, for example with a Extract from File node, and pass a base64 string or a URL into ${fieldLabel}.`;
		case 'object':
			return `${fieldLabel} received an object instead of text. Provide an image URL, a data URI, or a base64 string.`;
		case 'path':
			return `${fieldLabel} looks like a file path ("${truncate(problem.value)}"). Reading files from the n8n server is not supported. Provide an image URL, a data URI, or a base64 string instead.`;
		case 'unsupported':
			return `${fieldLabel} is not a supported image input ("${truncate(problem.value)}"). Provide an http(s) URL, a data URI, or a base64 string.`;
	}
}

function truncate(value: string, max = 60): string {
	return value.length > max ? `${value.slice(0, max)}...` : value;
}

/** Shared note appended to every image field description in the UI. */
export const IMAGE_FIELD_HINT =
	'Accepts an image URL, a data URI, or a base64 string. File paths and binary attachments are not supported. PNG and GIF images must be at most 1000px per side.';
