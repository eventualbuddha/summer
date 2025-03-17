import { getFilterOptions, getTransactions, type Account, type Category } from '$lib/db';
import type { Selection } from '$lib/types';
import type { PageLoad } from './$types';

export interface QueryParams {
	years?: number[];
	months?: number[];
	categories?: string[];
	accounts?: string[];
}

export const load: PageLoad = async ({ url }) => {
	const rawQuery = url.searchParams.get('query');
	const query: QueryParams = rawQuery ? JSON.parse(atob(rawQuery)) : {};

	const options = await getFilterOptions();
	const filters = {
		years: options.years.map<Selection<number>>((year) => ({
			value: year,
			key: year.toString(),
			selected: query.years?.includes(year) ?? true
		})),

		months: options.months.map<Selection<number>>((month) => ({
			value: month,
			key: month.toString(),
			selected: query.months?.includes(month) ?? true
		})),

		categories: options.categories.map<Selection<Category>>((category) => ({
			value: category,
			key: category.name,
			selected: query.categories?.some((id) => id === category.id) ?? true
		})),

		accounts: options.accounts.map<Selection<Account>>((account) => ({
			value: account,
			key: account.name,
			selected: query.accounts?.some((id) => id === account.id) ?? true
		}))
	};

	return {
		filters,
		transactions: getTransactions({
			years: filters.years
				.filter((selection) => selection.selected)
				.map((selection) => selection.value),
			months: filters.months
				.filter((selection) => selection.selected)
				.map((selection) => selection.value),
			categories: filters.categories
				.filter((selection) => selection.selected)
				.map((selection) => selection.value),
			accounts: filters.accounts
				.filter((selection) => selection.selected)
				.map((selection) => selection.value)
		})
	};
};
