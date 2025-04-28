import type { Account, Category, FilterOptions } from '$lib/db';
import type { Selection } from '$lib/types';

export class Filters {
	years: Selection<number>[] = $state([]);
	months: Selection<number>[] = $state([]);
	categories: Selection<Category>[] = $state([]);
	accounts: Selection<Account>[] = $state([]);
	searchTerm = $state('');
	#stickyTransactionIds: string[] = $state([]);

	constructor() {
		this.#enableResetStickyTransactionsEffect();
	}

	#enableResetStickyTransactionsEffect() {
		$effect(() => {
			// If any of these change…
			for (const selection of [...this.accounts, ...this.categories, ...this.months, ...this.years])
				void selection.selected;
			void this.searchTerm;

			// …clear the list of sticky transactions.
			console.log('clearing sticky transaction IDs');
			this.#stickyTransactionIds.length = 0;
		});
	}

	addStickyTransactionId(id: string): void {
		this.#stickyTransactionIds.push(id);
	}

	get stickyTransactionIds(): Set<string> {
		return new Set(this.#stickyTransactionIds);
	}

	resetOptions(filterOptions: FilterOptions): void {
		this.years = filterOptions.years.map((year) => ({
			key: year.toString(),
			value: year,
			selected: true
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
		this.searchTerm = '';
	}
}
