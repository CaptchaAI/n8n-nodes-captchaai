import type { INodeProperties } from 'n8n-workflow';

/**
 * How the node works through its input items.
 *
 * Solving is slow - a single CAPTCHA can take anywhere from a few seconds to
 * the full poll deadline - so anything more than a handful of items is worth
 * running in parallel. Parallel is capped by Batch Size rather than unbounded,
 * because the account's thread limit is the real constraint.
 */
export const concurrencyDescription: INodeProperties[] = [
	{
		displayName: 'Execution Mode',
		name: 'executionMode',
		type: 'options',
		noDataExpression: true,
		default: 'sequential',
		options: [
			{
				name: 'Sequential',
				value: 'sequential',
				description: 'Solve one item at a time, in input order',
			},
			{
				name: 'Parallel',
				value: 'parallel',
				description: 'Solve items in batches, which is much faster for many items',
			},
		],
		description: 'How to work through the input items',
	},
	{
		displayName: 'Batch Size',
		name: 'batchSize',
		type: 'number',
		noDataExpression: true,
		default: 5,
		typeOptions: { minValue: 1 },
		description: 'How many items to solve at the same time. Keep this at or below the thread limit of your CaptchaAI plan, otherwise items fail with a thread limit error.',
		displayOptions: { show: { executionMode: ['parallel'] } },
	},
];
