import { RecordId, Surreal } from 'surrealdb';
import {
	getFilterOptions,
	getTransactions,
	use,
	type Account,
	type Category,
	type FilterOptions,
	type Transaction,
	type Transactions
} from './db';
import type { Selection } from './types';
import { SvelteSet } from 'svelte/reactivity';

const LOCAL_STORAGE_KEY = 'lastDb';

export interface DatabaseConnectionInfo {
	url: string;
	namespace: string;
	database: string;
}

export interface FilterState {
	years: Selection<number>[];
	months: Selection<number>[];
	categories: Selection<Category>[];
	accounts: Selection<Account>[];
	searchTerm: string;
	stickyTransactionIds: Set<Transaction['id']>;
	updateCount: number;
}

export type SortingField = 'date' | 'amount' | 'statementDescription';
export type SortingDirection = 'asc' | 'desc';

export class Sorting {
	#defaultField: SortingField;
	#field = $state<SortingField>();
	#direction = $state<SortingDirection>();
	#fields: Record<SortingField, SortingDirection>;

	constructor(fields: Record<SortingField, SortingDirection>, defaultField: SortingField) {
		this.#defaultField = defaultField;
		this.#field = defaultField;
		this.#direction = fields[defaultField];
		this.#fields = fields;
	}

	sortBy(field: SortingField): void {
		if (field === this.#field) {
			this.#direction = this.#direction === 'asc' ? 'desc' : 'asc';
		} else {
			this.#field = field;
			this.#direction = this.#fields[field];
		}
	}

	fieldSort(field: SortingField): 'asc' | 'desc' | undefined {
		return this.#field === field ? this.#direction : undefined;
	}

	get field(): SortingField {
		return this.#field ?? this.#defaultField;
	}

	get direction(): SortingDirection {
		return this.#direction ?? this.#fields[this.#defaultField];
	}
}

const NEVER_PROMISE = new Promise<never>(() => {});

export class State {
	lastDb = $state<DatabaseConnectionInfo>();
	lastError = $state<Error>();
	#surreal = $state<Surreal>();

	#filterOptions = $state<FilterOptions>();
	filters = $state<FilterState>();
	transactions = $state<Transactions>();

	sort = $state(
		new Sorting(
			{
				date: 'desc',
				amount: 'asc',
				statementDescription: 'asc'
			},
			'date'
		)
	);

	constructor() {
		const lastDb = localStorage.getItem(LOCAL_STORAGE_KEY);
		if (lastDb) {
			this.lastDb = JSON.parse(lastDb);
		}

		$effect(() => {
			this.#updateFilters();
		});

		$effect(() => {
			if (this.filters) {
				this.#updateTransactions(this.filters);
			}
		});
	}

	async #updateFilters() {
		if (!this.#surreal) return NEVER_PROMISE;
		// reset sticky transaction IDs when the filters change
		this.#filterOptions = await getFilterOptions(this.#surreal);
		this.filters = {
			years: this.#filterOptions.years.map((year) => ({
				key: year.toString(),
				value: year,
				selected: true
			})),
			months: this.#filterOptions.months.map((month) => ({
				key: month.toString(),
				value: month,
				selected: true
			})),
			accounts: this.#filterOptions.accounts.map((account) => ({
				key: account.toString(),
				value: account,
				selected: true
			})),
			categories: this.#filterOptions.categories.map((category) => ({
				key: category.toString(),
				value: category,
				selected: true
			})),
			searchTerm: '',
			stickyTransactionIds: new SvelteSet(),
			updateCount: 0
		};
	}

	async #updateTransactions(filters: FilterState) {
		const surreal = this.#surreal;
		if (!surreal) return NEVER_PROMISE;

		const { sort } = this;
		const stickyTransactionIds = [...filters.stickyTransactionIds];

		// Trigger this method if this value changes.
		void filters.updateCount;

		this.transactions = await getTransactions(
			{
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
					.map((selection) => selection.value),
				searchTerm: filters.searchTerm,
				stickyTransactionIds,
				sort
			},
			surreal
		);
	}

	selectYears(keys: readonly string[]): void {
		this.#updateFiltersWith((filters) => {
			for (const yearFilter of filters.years) {
				yearFilter.selected = keys.includes(yearFilter.key);
			}
		});
	}

	selectMonths(keys: readonly string[]): void {
		this.#updateFiltersWith((filters) => {
			for (const monthFilter of filters.months) {
				monthFilter.selected = keys.includes(monthFilter.key);
			}
		});
	}

	selectCategories(keys: readonly string[]): void {
		this.#updateFiltersWith((filters) => {
			for (const categoryFilter of filters.categories) {
				categoryFilter.selected = keys.includes(categoryFilter.key);
			}
		});
	}

	selectAccounts(keys: readonly string[]): void {
		this.#updateFiltersWith((filters) => {
			for (const accountFilter of filters.accounts) {
				accountFilter.selected = keys.includes(accountFilter.key);
			}
		});
	}

	updateSearchTerm(searchTerm: string): void {
		this.#updateFiltersWith((filters) => {
			filters.searchTerm = searchTerm;
		});
	}

	#updateFiltersWith(callback: (filters: FilterState) => void): void {
		if (!this.filters) return;
		this.filters.stickyTransactionIds.clear();
		callback(this.filters);
	}

	get isConnected() {
		return !!this.#surreal;
	}

	async connect({
		url,
		namespace,
		database
	}: {
		url: string;
		namespace: string;
		database: string;
	}) {
		const surreal = new Surreal();
		await surreal.connect(url);
		await use(surreal, { namespace, database, init: true });

		localStorage.setItem(
			LOCAL_STORAGE_KEY,
			JSON.stringify({
				url,
				namespace,
				database
			})
		);

		this.#surreal = surreal;
	}

	async setCategory(transaction: Transaction, category: Category | undefined) {
		if (!this.#surreal) {
			throw new Error('Not connected to SurrealDB');
		}

		if (!this.filters) {
			throw new Error('No filters have been loaded');
		}

		const oldCategory = transaction.category;
		transaction.category = category;
		try {
			if (category) {
				await this.#surreal.query(`UPDATE $transaction SET category = $category`, {
					transaction: new RecordId('transaction', transaction.id),
					category: new RecordId('category', category.id)
				});
			} else {
				await this.#surreal.query(`UPDATE $transaction SET category = none`, {
					transaction: new RecordId('transaction', transaction.id)
				});
			}
			this.filters.stickyTransactionIds.add(transaction.id);
			this.filters.updateCount += 1;
		} catch (error) {
			console.error(error);
			this.lastError = error as Error;
			transaction.category = oldCategory;
		}
	}
}
