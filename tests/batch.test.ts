import { describe, expect, it } from 'vitest';

import { runInBatches } from '../nodes/CaptchaAi/libs/batch';

/** Records which item indices were in flight at the same moment. */
function makeSolver(behaviour: (index: number) => Promise<string>) {
	const chunks: number[][] = [];
	let inFlight: number[] = [];
	let settledInChunk = 0;

	return {
		chunks,
		solve: async (index: number) => {
			if (inFlight.length === 0) chunks.push(inFlight);
			inFlight.push(index);
			const current = inFlight;

			try {
				return await behaviour(index);
			} finally {
				settledInChunk += 1;
				if (settledInChunk === current.length) {
					inFlight = [];
					settledInChunk = 0;
				}
			}
		},
	};
}

async function collect(itemCount: number, chunkSize: number, behaviour: (i: number) => Promise<string>) {
	const results: Array<string | undefined> = new Array(itemCount);
	const failures: Array<unknown> = new Array(itemCount);
	const solver = makeSolver(behaviour);

	await runInBatches(itemCount, {
		chunkSize,
		solve: solver.solve,
		onSuccess: (index, value) => {
			results[index] = value;
		},
		onFailure: (index, error) => {
			failures[index] = error;
		},
	});

	return { results, failures, chunks: solver.chunks };
}

describe('runInBatches', () => {
	it('keeps results aligned with input order even when solves finish out of order', async () => {
		const { results } = await collect(6, 3, async (index) => {
			// Later items resolve first.
			await new Promise((resolve) => setTimeout(resolve, (6 - index) * 2));
			return `solved-${index}`;
		});

		expect(results).toEqual([
			'solved-0',
			'solved-1',
			'solved-2',
			'solved-3',
			'solved-4',
			'solved-5',
		]);
	});

	it('runs one item at a time when the chunk size is 1', async () => {
		const { chunks } = await collect(4, 1, async (index) => `solved-${index}`);
		expect(chunks).toEqual([[0], [1], [2], [3]]);
	});

	it('runs items in groups of the chunk size', async () => {
		const { chunks } = await collect(7, 3, async (index) => `solved-${index}`);
		expect(chunks).toEqual([
			[0, 1, 2],
			[3, 4, 5],
			[6],
		]);
	});

	it('isolates a failure from its siblings in the same chunk', async () => {
		const { results, failures } = await collect(4, 4, async (index) => {
			if (index === 1) throw new Error('item 1 failed');
			return `solved-${index}`;
		});

		expect(results[0]).toBe('solved-0');
		expect(results[2]).toBe('solved-2');
		expect(results[3]).toBe('solved-3');
		expect(results[1]).toBeUndefined();
		expect((failures[1] as Error).message).toBe('item 1 failed');
	});

	it('lets every sibling settle before onFailure aborts the run', async () => {
		const settled: number[] = [];
		const seen: number[] = [];

		await expect(
			runInBatches(4, {
				chunkSize: 4,
				solve: async (index) => {
					await new Promise((resolve) => setTimeout(resolve, index === 0 ? 1 : 6));
					settled.push(index);
					if (index === 0) throw new Error('fail fast');
					return index;
				},
				onSuccess: (index) => {
					seen.push(index);
				},
				onFailure: (_index, error) => {
					throw error;
				},
			}),
		).rejects.toThrow('fail fast');

		// The fast failure did not cancel the three slower siblings.
		expect(settled.sort()).toEqual([0, 1, 2, 3]);
		// And it aborted before reporting any of them as successes.
		expect(seen).toEqual([]);
	});

	it('does not start a later chunk once the run is aborted', async () => {
		const attempted: number[] = [];

		await expect(
			runInBatches(6, {
				chunkSize: 2,
				solve: async (index) => {
					attempted.push(index);
					if (index === 1) throw new Error('stop here');
					return index;
				},
				onSuccess: () => {},
				onFailure: (_index, error) => {
					throw error;
				},
			}),
		).rejects.toThrow('stop here');

		expect(attempted).toEqual([0, 1]);
	});

	it('reports every failure and keeps going when onFailure does not throw', async () => {
		const { results, failures } = await collect(4, 2, async (index) => {
			if (index % 2 === 0) throw new Error(`item ${index} failed`);
			return `solved-${index}`;
		});

		expect(results[1]).toBe('solved-1');
		expect(results[3]).toBe('solved-3');
		expect((failures[0] as Error).message).toBe('item 0 failed');
		expect((failures[2] as Error).message).toBe('item 2 failed');
	});

	it('does nothing when there are no items', async () => {
		const { results, chunks } = await collect(0, 3, async (index) => `solved-${index}`);
		expect(results).toEqual([]);
		expect(chunks).toEqual([]);
	});

	it('treats a chunk size below 1 as sequential', async () => {
		const { chunks } = await collect(3, 0, async (index) => `solved-${index}`);
		expect(chunks).toEqual([[0], [1], [2]]);
	});
});
