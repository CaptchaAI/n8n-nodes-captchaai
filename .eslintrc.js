/**
 * @type {import('@types/eslint').ESLint.ConfigData}
 */
module.exports = {
	root: true,

	env: {
		es6: true,
		node: true,
	},

	parser: '@typescript-eslint/parser',

	parserOptions: {
		project: ['./tsconfig.json'],
		sourceType: 'module',
		extraFileExtensions: ['.json'],
	},

	ignorePatterns: [
		'.eslintrc.js',
		'**/*.js',
		'**/node_modules/**',
		'**/dist/**',
		'tsup.config.ts',
	],

	overrides: [
		{
			files: ['package.json'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/community'],
			// package.json is not part of the TS program.
			parserOptions: { project: null },
			rules: {
				'n8n-nodes-base/community-package-json-name-still-default': 'off',
			},
		},
		// The rules turned off below are the same ones @n8n/scan-community-package
		// disables, so a local lint run agrees with the verification scan. In
		// particular, documentation-url-miscased autofixes a real URL into a
		// camelCased identifier.
		{
			files: ['./credentials/**/*.ts'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/credentials'],
			rules: {
				'n8n-nodes-base/cred-class-field-documentation-url-miscased': 'off',
				'n8n-nodes-base/cred-class-field-type-options-password-missing': 'off',
			},
		},
		{
			files: ['./nodes/**/*.ts'],
			plugins: ['eslint-plugin-n8n-nodes-base'],
			extends: ['plugin:n8n-nodes-base/nodes'],
			rules: {
				'n8n-nodes-base/node-class-description-inputs-wrong-regular-node': 'off',
				'n8n-nodes-base/node-class-description-outputs-wrong': 'off',
				'n8n-nodes-base/node-param-type-options-max-value-present': 'off',
			},
		},
	],
};
