import { getFilterOptions, type Account, type Category } from '$lib/db';
import { type Selection } from '$lib/types';

export function createFilters() {
	let years = $state<Selection<number>[]>([]);
	let months = $state<Selection<number>[]>([]);
	let categories = $state<Selection<Category>[]>([]);
	let accounts = $state<Selection<Account>[]>([]);

	async function refresh() {
		const options = await getFilterOptions();
		years = options.years.map((year) => ({
			key: year.toString(),
			value: year,
			selected: true
		}));
		months = options.months.map((month) => ({
			key: month.toString(),
			value: month,
			selected: true
		}));
		categories = options.categories.map((category) => ({
			key: category.id,
			value: category,
			selected: true
		}));
		accounts = options.accounts.map((account) => ({
			key: account.id,
			value: account,
			selected: true
		}));
	}

	void refresh();

	return {
		get years() {
			return years;
		},
		get months() {
			return months;
		},
		get categories() {
			return categories;
		},
		get accounts() {
			return accounts;
		},
		refresh
	};
}
