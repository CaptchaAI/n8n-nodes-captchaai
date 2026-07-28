/**
 * Build-time replacement for captchaai-javascript's `helpers/image.js`.
 *
 * The SDK version resolves an image input by trying, in order: bytes, an
 * http(s) URL, a data URI, `fs.readFile()` on the string as a path, and
 * finally raw base64. Two problems with shipping that inside an n8n community
 * node:
 *
 *   1. Reading a workflow-supplied string off the n8n server's disk is a
 *      security hazard, and the project plan scopes this field to URL or
 *      base64 only.
 *   2. `node:fs/promises` is a restricted import under n8n's verification
 *      rules. esbuild always treats `node:`-prefixed specifiers as external,
 *      so neither an alias nor an onResolve hook can strip it - the only way
 *      to keep it out of the bundle is to replace the module that imports it.
 *
 * This module keeps the SDK's behaviour byte for byte, minus the file-path
 * branch. `tests/sdkImageResolver.test.ts` pins it against the real SDK module
 * so the two cannot silently diverge.
 */
import { ValidationError } from 'captchaai-javascript';

const MAX_IMAGE_DIMENSION = 1000;

function isBase64(value) {
	if (value.length === 0 || value.length % 4 !== 0) return false;
	return /^[A-Za-z0-9+/]+={0,2}$/.test(value);
}

function checkImageDimensions(rawBytes) {
	if (rawBytes.length < 10) return;

	if (
		rawBytes.length >= 24 &&
		rawBytes[0] === 0x89 &&
		rawBytes[1] === 0x50 &&
		rawBytes[2] === 0x4e &&
		rawBytes[3] === 0x47
	) {
		const width = rawBytes.readUInt32BE(16);
		const height = rawBytes.readUInt32BE(20);
		if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
			throw new ValidationError(
				`Image dimensions ${width}x${height} exceed the ${MAX_IMAGE_DIMENSION}px per-side limit`,
			);
		}
		return;
	}

	const gifHeader = rawBytes.subarray(0, 6).toString('ascii');
	if (gifHeader === 'GIF87a' || gifHeader === 'GIF89a') {
		const width = rawBytes.readUInt16LE(6);
		const height = rawBytes.readUInt16LE(8);
		if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
			throw new ValidationError(
				`Image dimensions ${width}x${height} exceed the ${MAX_IMAGE_DIMENSION}px per-side limit`,
			);
		}
	}
}

async function toBase64(src) {
	if (src instanceof Uint8Array) {
		const buffer = Buffer.from(src);
		checkImageDimensions(buffer);
		return buffer.toString('base64');
	}

	const s = src.trim();

	if (s.startsWith('http://') || s.startsWith('https://')) {
		const response = await fetch(s);
		if (!response.ok) {
			throw new ValidationError(`Failed to download image from URL: HTTP ${response.status}`);
		}
		const arrayBuffer = await response.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		checkImageDimensions(buffer);
		return buffer.toString('base64');
	}

	if (s.startsWith('data:') && s.includes(',')) {
		const payload = s.split(',', 2)[1] ?? '';
		const decoded = Buffer.from(payload, 'base64');
		checkImageDimensions(decoded);
		return payload;
	}

	if (isBase64(s)) {
		const decoded = Buffer.from(s, 'base64');
		checkImageDimensions(decoded);
		return s;
	}

	throw new ValidationError(
		'Unsupported image input: expected an http(s) URL, a data URI, or a base64 string',
	);
}

export async function resolve(params) {
	if (params.images !== undefined) {
		const images = params.images;
		if (!Array.isArray(images) || images.length === 0) {
			throw new ValidationError("'images' must be a non-empty list");
		}
		if (images.length !== 9) {
			throw new ValidationError('BLS requires exactly 9 images (one per grid cell)');
		}
		delete params.images;
		for (let i = 0; i < images.length; i += 1) {
			const img = images[i];
			if (typeof img !== 'string' && !(img instanceof Uint8Array)) {
				throw new ValidationError('Each BLS image must be a URL, data URI, base64 string, or bytes');
			}
			const b64 = await toBase64(img);
			params[`image_base64_${i + 1}`] = `data:image/png;base64,${b64}`;
		}
		return;
	}

	const image = params.image;
	if (image === undefined || image === null) {
		throw new ValidationError("'image' is required");
	}
	if (typeof image !== 'string' && !(image instanceof Uint8Array)) {
		throw new ValidationError("'image' must be a URL, data URI, base64 string, or bytes");
	}
	delete params.image;
	params.body = await toBase64(image);
}
