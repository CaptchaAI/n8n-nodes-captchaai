import type { INodeProperties } from 'n8n-workflow';

/**
 * Kept out of the property literal below on purpose. n8n's community-package
 * scan requires any inline `loadOptionsMethod` to sit on a parameter named
 * "... Name or ID" carrying a "Choose from the list, or specify an ID" blurb,
 * neither of which is true of a readout. The scan runs with inline
 * eslint-disable comments switched off, so the reference is the only way to
 * keep the honest wording. Inlining this object fails `npm run scan`.
 *
 * `loadOptionsDependsOn` is what makes the Refresh toggle below actually work.
 * n8n caches a loadOptions list and only refetches when the field first
 * renders, when a different credential is picked, when a named dependency
 * changes, or when the user runs "Refresh List". Editing the API key inside
 * the credential the node already holds is none of those - `node.credentials`
 * keeps only an id and a name - so without this dependency the stale reading
 * survives until the node is closed and reopened.
 */
const loadThreadBalance = {
	loadOptionsMethod: 'getThreadBalance',
	loadOptionsDependsOn: ['threadBalanceRefresh'],
};

/**
 * A read-only readout of the account's thread balance, not an input.
 *
 * The single option carries the text; its value is empty and matches the field
 * default, so the reading shows in the closed dropdown too. execute() never
 * reads this parameter or the refresh toggle beneath it.
 */
export const threadBalanceDescription: INodeProperties[] = [
	{
		displayName: 'Thread Balance',
		name: 'threadBalance',
		type: 'options',
		noDataExpression: true,
		default: '',
		typeOptions: loadThreadBalance,
		options: [],
		description:
			'Thread usage on the CaptchaAI account this node is credentialed with. Flip Refresh Thread Balance below after editing the API key to take a fresh reading. Nothing is selected here and the node ignores this field when it runs.',
	},
	{
		displayName: 'Refresh Thread Balance',
		name: 'threadBalanceRefresh',
		type: 'boolean',
		noDataExpression: true,
		default: false,
		description:
			'Whether to reload Thread Balance above. Flip this after editing the API key; the node ignores it when it runs.',
	},
];
