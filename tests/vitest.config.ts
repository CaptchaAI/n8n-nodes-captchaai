import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export default defineConfig({
	root: repoRoot,
	// n8n-workflow ships sourcemaps whose source files are not published, and
	// Vite warns once per module about it. Errors still surface.
	logLevel: 'error',
	test: {
		environment: 'node',
		include: ['tests/**/*.test.ts'],
	},
});
