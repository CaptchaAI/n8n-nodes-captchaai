import type { INodeProperties } from 'n8n-workflow';

/**
 * Optional, collapsed by default. Every field here maps to a CaptchaAI client
 * option and applies to the whole execution, not to a single item.
 *
 * The default is not `{}` on purpose. n8n renders a collection option only
 * once it appears in the collection's value, and lists every other option in
 * the "Add Setting" dropdown - so a notice left out of the default would be
 * offered as something to add rather than shown as orientation text. Seeding
 * the value with the notice key renders it at the top of the section and takes
 * it out of that dropdown. execute() ignores the key.
 */
export const settingsDescription: INodeProperties[] = [
	{
		displayName: 'Settings',
		name: 'settings',
		type: 'collection',
		placeholder: 'Add Setting',
		default: { settingsNotice: '' },
		options: [
			{
				displayName:
					'Advanced options for polling time, retries, and proxy. Leave any field out to use safe defaults.',
				name: 'settingsNotice',
				type: 'notice',
				default: '',
			},
			{
				displayName: 'Include Raw API Response',
				name: 'includeRaw',
				type: 'boolean',
				default: false,
				description: 'Whether to add the untouched CaptchaAI API response to the output under "raw". Useful when debugging an unexpected solution shape.',
			},
			{
				displayName: 'Max Poll Time',
				name: 'maxPollSeconds',
				type: 'number',
				default: 180,
				typeOptions: { minValue: 10 },
				description: 'How long to wait for a result before giving up, in seconds. Hard CAPTCHAs can take over a minute.',
			},
			{
				displayName: 'Max Retry Attempts',
				name: 'maxRetries',
				type: 'number',
				default: 5,
				typeOptions: { minValue: 1 },
				description: 'How many times to retry a transient API error before failing the item. Network failures are never retried.',
			},
			{
				displayName: 'Proxy',
				name: 'proxy',
				type: 'string',
				default: '',
				placeholder: 'user:password@1.2.3.4:8080',
				description:
					'Proxy for CaptchaAI to solve through, for CAPTCHA types where a proxy is optional. Cloudflare Challenge and CaptchaFox require a proxy - use the dedicated Proxy field shown directly on the node for those instead of this one.',
			},
			{
				displayName: 'Proxy Type',
				name: 'proxyType',
				type: 'options',
				default: 'HTTP',
				options: [
					{ name: 'HTTP', value: 'HTTP' },
					{ name: 'HTTPS', value: 'HTTPS' },
					{ name: 'SOCKS4', value: 'SOCKS4' },
					{ name: 'SOCKS5', value: 'SOCKS5' },
				],
				description: 'Protocol of the proxy above. Only used when Proxy is set.',
			},
		],
	},
];
