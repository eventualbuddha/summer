import type { Category } from '$lib/db';

export const NONE_CATEGORY: Category = {
	id: 'none',
	name: 'None',
	ordinal: Infinity,
	color: 'gray-300',
	emoji: '🚫'
};
