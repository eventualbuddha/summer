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

	const yearSelections = options.years.map<Selection<number>>((year) => ({
		value: year,
		key: year.toString(),
		selected: query.years?.includes(year) ?? true
	}));

	const monthSelections = options.months.map<Selection<number>>((m) => ({
		value: m,
		key: m.toString(),
		selected: query.months?.includes(m) ?? true
	}));

	const categorySelections = options.categories.map<Selection<Category>>((category) => ({
		value: category,
		key: category.name,
		selected: query.categories?.some((id) => id === category.id) ?? true
	}));

	const accountSelections = options.accounts.map<Selection<Account>>((account) => ({
		value: account,
		key: account.name,
		selected: query.accounts?.some((id) => id === account.id) ?? true
	}));

	const { count, total, transactions, totalByYear, totalByCategory, totalByAccount } =
		await getTransactions({
			years: yearSelections
				.filter((selection) => selection.selected)
				.map((selection) => selection.value),
			months: monthSelections
				.filter((selection) => selection.selected)
				.map((selection) => selection.value),
			categories: categorySelections
				.filter((selection) => selection.selected)
				.map((selection) => selection.value),
			accounts: accountSelections
				.filter((selection) => selection.selected)
				.map((selection) => selection.value)
		});

	return {
		count,
		total,
		totalByYear,
		totalByCategory,
		totalByAccount,
		transactions,
		yearSelections,
		monthSelections,
		categorySelections,
		accountSelections
	};
};
