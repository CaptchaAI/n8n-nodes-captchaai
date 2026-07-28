export interface BatchRunOptions<TResult> {
	/** Number of items to run at once. Sequential is simply a size of 1. */
	chunkSize: number;
	/** Solves one item. Rejections are isolated to that item. */
	solve: (itemIndex: number) => Promise<TResult>;
	/** Called for a successful item, in completion order. */
	onSuccess: (itemIndex: number, result: TResult) => void;
	/**
	 * Called for a failed item. Returning normally continues the run; throwing
	 * aborts it, which is how Continue On Fail is expressed by the caller.
	 */
	onFailure: (itemIndex: number, error: unknown) => void;
}

/**
 * Runs `itemCount` solves in chunks.
 *
 * Every chunk is settled with Promise.allSettled before anything is inspected,
 * so one failure never cancels or orphans its siblings: each in-flight solve
 * either resolves or rejects, and both outcomes are observed. Results are
 * reported per item index rather than in completion order, which lets the
 * caller keep the output aligned with the input.
 *
 * When `onFailure` throws, the throw happens after the chunk has fully
 * settled, so no promise is left dangling behind the abort.
 */
export async function runInBatches<TResult>(
	itemCount: number,
	options: BatchRunOptions<TResult>,
): Promise<void> {
	const chunkSize = Math.max(1, Math.floor(options.chunkSize));

	for (let start = 0; start < itemCount; start += chunkSize) {
		const indices: number[] = [];
		for (let index = start; index < Math.min(start + chunkSize, itemCount); index += 1) {
			indices.push(index);
		}

		const settled = await Promise.allSettled(indices.map((index) => options.solve(index)));

		for (let position = 0; position < settled.length; position += 1) {
			const itemIndex = indices[position];
			const outcome = settled[position];

			if (outcome.status === 'fulfilled') {
				options.onSuccess(itemIndex, outcome.value);
			} else {
				// May throw to abort the whole run - only ever after the chunk
				// has settled, so nothing is left in flight.
				options.onFailure(itemIndex, outcome.reason);
			}
		}
	}
}
