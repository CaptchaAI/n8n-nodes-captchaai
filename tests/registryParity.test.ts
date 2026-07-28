import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

import { CAPTCHA_TYPES } from '../nodes/CaptchaAi/config/captchaTypes';
import { CAPTCHA_TYPE_NAMES } from '../nodes/CaptchaAi/libs/types';

/**
 * captchaai-javascript does not re-export its internal registry, and its
 * `exports` map blocks deep imports, so the node keeps its own catalog. These
 * tests load the registry module straight off disk - a direct file path is not
 * subject to the exports map - so an SDK upgrade that adds, renames, or
 * re-flags a CAPTCHA type fails the build instead of silently leaving the
 * node's dropdown stale.
 */
interface RegistryEntry {
	name: string;
	requiredParams: readonly string[];
	hasImage: boolean;
	requiresProxy?: boolean;
}

const REGISTRY_PATH = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'..',
	'node_modules',
	'captchaai-javascript',
	'dist',
	'core',
	'registry.js',
);

async function loadSdkRegistry(): Promise<Record<string, RegistryEntry>> {
	const module = (await import(pathToFileURL(REGISTRY_PATH).href)) as {
		REGISTRY: Record<string, RegistryEntry>;
	};
	return module.REGISTRY;
}

describe('SDK registry parity', () => {
	it('covers exactly the CAPTCHA types the SDK registry defines', async () => {
		const registry = await loadSdkRegistry();
		expect([...CAPTCHA_TYPE_NAMES].sort()).toEqual(Object.keys(registry).sort());
	});

	it('keys every registry entry by its own name', async () => {
		const registry = await loadSdkRegistry();
		for (const [key, entry] of Object.entries(registry)) {
			expect(entry.name).toBe(key);
		}
	});

	it('flags the same proxy-only types as the SDK', async () => {
		const registry = await loadSdkRegistry();
		const sdkProxyTypes = Object.values(registry)
			.filter((entry) => entry.requiresProxy === true)
			.map((entry) => entry.name)
			.sort();
		const catalogProxyTypes = CAPTCHA_TYPES.filter((type) => type.requiresProxy === true)
			.map((type) => type.value)
			.sort();

		expect(catalogProxyTypes).toEqual(sdkProxyTypes);
	});

	it('exposes one dropdown entry per registry type', () => {
		expect(CAPTCHA_TYPES).toHaveLength(CAPTCHA_TYPE_NAMES.length);
		expect(CAPTCHA_TYPES.map((type) => type.value).sort()).toEqual([...CAPTCHA_TYPE_NAMES].sort());
	});
});
