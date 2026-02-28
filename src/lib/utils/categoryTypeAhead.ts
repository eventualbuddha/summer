import type { Category } from '$lib/db';
import { NONE_CATEGORY } from './categories';

/**
 * Creates a type-ahead handler for category selection, matching the behaviour
 * of a native <select> element. Returns a function that accepts a keydown
 * event key; returns true if the key was consumed (so the caller can
 * preventDefault and stop propagation), false otherwise.
 *
 * Space is intentionally not consumed so the browser's default button
 * behaviour (click/open) fires instead.
 */
export function createCategoryTypeAhead(
	getCategories: () => readonly Category[],
	onSelect: (category: Category | undefined) => void
): (key: string) => boolean {
	let prefix = '';
	let timeout: ReturnType<typeof setTimeout> | undefined;

	return (key: string): boolean => {
		if (key.length !== 1 || key === ' ') return false;
		if (timeout) clearTimeout(timeout);
		prefix += key;
		timeout = setTimeout(() => {
			prefix = '';
		}, 500);
		const prefixLower = prefix.toLowerCase();
		const match = [...getCategories(), NONE_CATEGORY].find((c) =>
			c.name.toLowerCase().startsWith(prefixLower)
		);
		if (match) onSelect(match.id === NONE_CATEGORY.id ? undefined : match);
		return true;
	};
}
