import path from 'node:path';
import type { Plugin } from 'esbuild';
import { defineConfig } from 'tsup';

/**
 * Swaps the bundled SDK's image helper for an fs-free equivalent.
 *
 * The SDK's `helpers/image.js` imports `node:fs/promises` to support passing a
 * local file path as the image. n8n's verification scan rejects that import in
 * shipped code, and the node never allows file paths anyway. esbuild treats
 * every `node:`-prefixed specifier as external, so the import cannot be
 * aliased or hooked away - the module that contains it has to be replaced.
 */
const replaceSdkImageHelper: Plugin = {
	name: 'replace-sdk-image-helper',
	setup(build) {
		build.onResolve({ filter: /helpers[\\/]image\.js$/ }, (args) => {
			const importer = args.importer.replace(/\\/g, '/');
			if (!importer.includes('/captchaai-javascript/')) return null;
			return { path: path.resolve(__dirname, 'build/sdk-image-resolver.js') };
		});
	},
};

export default defineConfig({
	entry: {
		'nodes/CaptchaAi/CaptchaAi.node': 'nodes/CaptchaAi/CaptchaAi.node.ts',
		'credentials/CaptchaAiApi.credentials': 'credentials/CaptchaAiApi.credentials.ts',
	},
	format: ['cjs'],
	platform: 'node',
	target: 'node20',
	external: ['n8n-workflow'],
	outDir: 'dist',
	clean: true,
	// Rewrites the bundled SDK's `setTimeout` calls onto n8n's sleep helper.
	inject: ['./build/timers-shim.js'],
	esbuildPlugins: [replaceSdkImageHelper],
	// n8n's DirectoryLoader resolves the class by filename, so exported class
	// names must survive the build exactly as written.
	minify: false,
	keepNames: true,
	sourcemap: false,
	splitting: false,
	dts: false,
});
