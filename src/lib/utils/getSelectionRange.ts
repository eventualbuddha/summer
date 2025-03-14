import type { Selection } from '$lib/types';

/**
 * Get the single range of selected items in a list of selections. If there is
 * no range, return undefined.
 */
export function getSelectionRange<T>(
	selections: Selection<T>[]
): [Selection<T>, Selection<T>] | undefined {
	let start: Selection<T> | undefined = undefined;
	let end: Selection<T> | undefined = undefined;

	for (let i = 0; i < selections.length; i += 1) {
		const selection = selections[i]!;

		if (selection.selected) {
			if (start === undefined) {
				start = selection;
			} else if (end !== undefined) {
				return undefined;
			}
		} else if (start !== undefined && end === undefined) {
			end = selections[i - 1]!;
		}
	}

	end ??= selections[selections.length - 1];

	return start !== undefined && end !== undefined ? [start, end] : undefined;
}
