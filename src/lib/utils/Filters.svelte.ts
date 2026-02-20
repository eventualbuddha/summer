import { SvelteSet as Set } from 'svelte/reactivity';
import type { Account, Category, FilterOptions } from '$lib/db';
import type { SearchFilter, Selection } from '$lib/types';

export class Filters {
	years: Selection<number>[] = $state([]);
	months: Selection<number>[] = $state([]);
	categories: Selection<Category>[] = $state([]);
	accounts: Selection<Account>[] = $state([]);
	searchText = $state('');
	searchFilters: SearchFilter[] = $state([]);
	#stickyTransactionIds: string[] = $state([]);

	constructor() {
		this.#enableResetStickyTransactionsEffect();
	}

	#enableResetStickyTransactionsEffect() {
		$effect(() => {
			// If any of these change…
			for (const selection of [...this.accounts, ...this.categories, ...this.months, ...this.years])
				void selection.selected;
			void this.searchText;
			void this.searchFilters;

			// …clear the list of sticky transactions.
			console.log('clearing sticky transaction IDs');
			this.#stickyTransactionIds = [];
		});
	}

	addStickyTransactionId(id: string): void {
		this.#stickyTransactionIds.push(id);
	}

	get stickyTransactionIds(): Set<string> {
		return new Set(this.#stickyTransactionIds);
	}

	resetOptions(filterOptions: FilterOptions): void {
		const maxYear = filterOptions.years.length > 0 ? Math.max(...filterOptions.years) : null;
		this.years = filterOptions.years.map((year) => ({
			key: year.toString(),
			value: year,
			selected: year === maxYear
		}));
		this.months = filterOptions.months.map((month) => ({
			key: month.toString(),
			value: month,
			selected: true
		}));
		this.accounts = filterOptions.accounts.map((account) => ({
			key: account.id.toString(),
			value: account,
			selected: true
		}));
		this.categories = filterOptions.categories.map((category) => ({
			key: category.id.toString(),
			value: category,
			selected: true
		}));
	}
}
