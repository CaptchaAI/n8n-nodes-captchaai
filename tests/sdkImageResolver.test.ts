import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ValidationError } from 'captchaai-javascript';
import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * The build replaces the SDK's `helpers/image.js` with `build/sdk-image-resolver.js`
 * so that `node:fs/promises` stays out of the shipped bundle (see tsup.config.ts).
 *
 * These tests run both modules over the same inputs and require identical
 * results, so the replacement cannot drift from the SDK. The single deliberate
 * difference - a bare file path resolves in the SDK and is rejected here - is
 * asserted explicitly.
 */
const testDir = path.dirname(fileURLToPath(import.meta.url));

type Resolver = { resolve(params: Record<string, unknown>): Promise<void> };

const ours = (await import(
	pathToFileURL(path.resolve(testDir, '..', 'build', 'sdk-image-resolver.js')).href
)) as Resolver;

const sdk = (await import(
	pathToFileURL(
		path.resolve(
			testDir,
			'..',
			'node_modules',
			'captchaai-javascript',
			'dist',
			'helpers',
			'image.js',
		),
	).href
)) as Resolver;

/** Minimal valid PNG header carrying the given dimensions. */
function pngBytes(width: number, height: number): Buffer {
	const buffer = Buffer.alloc(24);
	buffer.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
	buffer.write('IHDR', 12, 'ascii');
	buffer.writeUInt32BE(width, 16);
	buffer.writeUInt32BE(height, 20);
	return buffer;
}

const smallPng = pngBytes(320, 120);
const smallPngBase64 = smallPng.toString('base64');

async function runBoth(makeParams: () => Record<string, unknown>) {
	const settle = async (resolver: Resolver) => {
		const params = makeParams();
		try {
			await resolver.resolve(params);
			return { params };
		} catch (error) {
			return { error: error as Error };
		}
	};

	return { mine: await settle(ours), theirs: await settle(sdk) };
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('SDK image resolver replacement', () => {
	it('resolves a data URI the same way', async () => {
		const { mine, theirs } = await runBoth(() => ({
			image: `data:image/png;base64,${smallPngBase64}`,
		}));

		expect(mine.params).toEqual(theirs.params);
		expect(mine.params).toEqual({ body: smallPngBase64 });
	});

	it('resolves a raw base64 string the same way', async () => {
		const { mine, theirs } = await runBoth(() => ({ image: smallPngBase64 }));

		expect(mine.params).toEqual(theirs.params);
		expect(mine.params).toEqual({ body: smallPngBase64 });
	});

	it('resolves raw bytes the same way', async () => {
		const { mine, theirs } = await runBoth(() => ({ image: new Uint8Array(smallPng) }));

		expect(mine.params).toEqual(theirs.params);
		expect(mine.params).toEqual({ body: smallPngBase64 });
	});

	it('downloads a URL the same way', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => ({
				ok: true,
				status: 200,
				arrayBuffer: async () => smallPng.buffer.slice(0, smallPng.length),
			})),
		);

		const { mine, theirs } = await runBoth(() => ({ image: 'https://example.com/captcha.png' }));

		expect(mine.params).toEqual(theirs.params);
		expect(mine.params).toEqual({ body: smallPngBase64 });
	});

	it('reports a failed download the same way', async () => {
		vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404 })));

		const { mine, theirs } = await runBoth(() => ({ image: 'https://example.com/missing.png' }));

		expect(mine.error?.message).toBe(theirs.error?.message);
		expect(mine.error).toBeInstanceOf(ValidationError);
	});

	it('enforces the same 1000px per-side limit', async () => {
		const { mine, theirs } = await runBoth(() => ({
			image: pngBytes(1200, 400).toString('base64'),
		}));

		expect(mine.error?.message).toBe(theirs.error?.message);
		expect(mine.error?.message).toContain('1200x400');
	});

	it('builds the same nine BLS slots', async () => {
		const { mine, theirs } = await runBoth(() => ({
			images: Array.from({ length: 9 }, () => smallPngBase64),
		}));

		expect(mine.params).toEqual(theirs.params);
		expect(Object.keys(mine.params ?? {})).toEqual([
			'image_base64_1',
			'image_base64_2',
			'image_base64_3',
			'image_base64_4',
			'image_base64_5',
			'image_base64_6',
			'image_base64_7',
			'image_base64_8',
			'image_base64_9',
		]);
	});

	it('rejects the wrong number of BLS images the same way', async () => {
		const { mine, theirs } = await runBoth(() => ({
			images: Array.from({ length: 8 }, () => smallPngBase64),
		}));

		expect(mine.error?.message).toBe(theirs.error?.message);
		expect(mine.error?.message).toContain('exactly 9 images');
	});

	it('reports a missing image the same way', async () => {
		const { mine, theirs } = await runBoth(() => ({}));

		expect(mine.error?.message).toBe(theirs.error?.message);
		expect(mine.error?.message).toContain("'image' is required");
	});

	it('deliberately refuses a file path that the SDK would read from disk', async () => {
		const { mine } = await runBoth(() => ({ image: './captcha.png' }));

		expect(mine.error).toBeInstanceOf(ValidationError);
		expect(mine.error?.message).toContain('Unsupported image input');
	});
});
