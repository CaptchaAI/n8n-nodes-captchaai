import { describe, expect, it } from 'vitest';

import {
	describeImageProblem,
	validateImageInput,
} from '../nodes/CaptchaAi/libs/imageInput';

describe('validateImageInput', () => {
	it('accepts http and https URLs', () => {
		expect(validateImageInput('https://example.com/captcha.png').value).toBe(
			'https://example.com/captcha.png',
		);
		expect(validateImageInput('http://example.com/captcha.png').value).toBe(
			'http://example.com/captcha.png',
		);
	});

	it('accepts a data URI', () => {
		const dataUri = 'data:image/png;base64,iVBORw0KGgo=';
		expect(validateImageInput(dataUri).value).toBe(dataUri);
	});

	it('accepts a raw base64 string', () => {
		expect(validateImageInput('iVBORw0KGgo=').value).toBe('iVBORw0KGgo=');
	});

	it('accepts JPEG base64 that starts with /9j/ (not a file path)', () => {
		const jpegB64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdC';
		expect(validateImageInput(jpegB64).value).toBe(jpegB64);
		expect(validateImageInput(jpegB64).problem).toBeUndefined();
	});

	it('strips whitespace out of a line-wrapped base64 string', () => {
		expect(validateImageInput('iVBORw0K\n  Ggo=').value).toBe('iVBORw0KGgo=');
	});

	it.each([
		['/etc/passwd', 'path'],
		['C:\\Windows\\Temp\\captcha.png', 'path'],
		['./relative.png', 'path'],
		['../up/one.png', 'path'],
		['captcha.png', 'path'],
		['file:///etc/passwd', 'path'],
		['\\\\server\\share\\captcha.png', 'path'],
		['images\\captcha.bin', 'path'],
	])('rejects %s as a file path', (input, kind) => {
		const result = validateImageInput(input);
		expect(result.value).toBeUndefined();
		expect(result.problem?.kind).toBe(kind);
	});

	it('rejects a string that is neither a URL, data URI, nor base64', () => {
		const result = validateImageInput('please solve this captcha');
		expect(result.problem?.kind).toBe('unsupported');
	});

	it('reports an empty field', () => {
		expect(validateImageInput('   ').problem?.kind).toBe('empty');
		expect(validateImageInput(undefined).problem?.kind).toBe('empty');
	});

	it('names the binary property when the field is empty and the item has binary data', () => {
		const result = validateImageInput('', ['data']);
		expect(result.problem).toEqual({ kind: 'binary', binaryProperty: 'data' });
	});

	it('reports an object value as a binary attachment when one is present', () => {
		const result = validateImageInput({ mimeType: 'image/png' }, ['attachment_0']);
		expect(result.problem).toEqual({ kind: 'binary', binaryProperty: 'attachment_0' });
	});

	it('reports an object value on its own when the item has no binary data', () => {
		expect(validateImageInput({ mimeType: 'image/png' }).problem?.kind).toBe('object');
	});
});

describe('describeImageProblem', () => {
	it('tells the user how to convert a binary attachment', () => {
		const message = describeImageProblem({ kind: 'binary', binaryProperty: 'data' }, 'Image');
		expect(message).toContain('"data"');
		expect(message).toContain('base64');
	});

	it('explains that file paths are not read from disk', () => {
		const message = describeImageProblem({ kind: 'path', value: '/etc/passwd' }, 'Image');
		expect(message).toContain('/etc/passwd');
		expect(message).toContain('not supported');
	});

	it('truncates a very long offending value', () => {
		const message = describeImageProblem({ kind: 'unsupported', value: 'x'.repeat(200) }, 'Image');
		expect(message).toContain('...');
		expect(message.length).toBeLessThan(250);
	});
});
