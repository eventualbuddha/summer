import { RecordId, Surreal, Table } from 'surrealdb';
import {
	getFilterOptions,
	getTransactions,
	use,
	type Account,
	type Category,
	type GetTransactionsOptions,
	type Transaction,
	type Transactions
} from './db';
import { Filters } from './utils/Filters.svelte';
import type { Selection } from './types';
import { Fetcher } from './utils/Fetcher';
import { NEVER_PROMISE } from './utils/promises';

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

export class State {
	lastDb = $state<DatabaseConnectionInfo>();
	lastError = $state<Error>();
	#surreal = $state<Surreal>();

	filters = $state(new Filters());
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
			this.#updateTransactions([...this.filters.stickyTransactionIds]);
		});
	}

	async #updateFilters() {
		if (!this.#surreal) return NEVER_PROMISE;
		this.filters.resetOptions(await getFilterOptions(this.#surreal));
	}

	#getTransactionsFetcher = new Fetcher<
		[options: GetTransactionsOptions, surreal: Surreal],
		Transactions
	>((options, surreal, signal) => getTransactions(options, surreal, signal));

	async #updateTransactions(stickyTransactionIds: readonly string[]) {
		const surreal = this.#surreal;
		if (!surreal) return NEVER_PROMISE;

		const { sort } = this;

		const options: GetTransactionsOptions = {
			years: this.filters.years
				.filter((selection) => selection.selected)
				.map((selection) => selection.value),
			months: this.filters.months
				.filter((selection) => selection.selected)
				.map((selection) => selection.value),
			categories: this.filters.categories
				.filter((selection) => selection.selected)
				.map((selection) => selection.value),
			accounts: this.filters.accounts
				.filter((selection) => selection.selected)
				.map((selection) => selection.value),
			searchTerm: this.filters.searchTerm,
			stickyTransactionIds,
			sort
		};

		this.transactions = await this.#getTransactionsFetcher.fetch(options, surreal);
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

		const oldCategory = transaction.categoryId;
		transaction.categoryId = category?.id;
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
			this.filters.addStickyTransactionId(transaction.id);
		} catch (error) {
			console.error(error);
			this.lastError = error as Error;
			transaction.categoryId = oldCategory;
		}
	}

	async createAccount(account: Omit<Account, 'id'> & { id?: string }) {
		if (!this.#surreal) {
			throw new Error('Not connected to SurrealDB');
		}
		await this.#surreal.create(new Table('account'), account);
		await this.#updateFilters();
	}

	async updateAccountName(accountId: string, name: string) {
		if (!this.#surreal) {
			throw new Error('Not connected to SurrealDB');
		}
		await this.#surreal.query(`UPDATE account SET name = $name WHERE id = $id`, {
			id: new RecordId('account', accountId),
			name
		});
	}

	async updateAccountNumber(accountId: string, number?: string) {
		if (!this.#surreal) {
			throw new Error('Not connected to SurrealDB');
		}
		await this.#surreal.query(`UPDATE account SET number = $number WHERE id = $id`, {
			id: new RecordId('account', accountId),
			number
		});
	}

	async updateAccountType(accountId: string, type: string) {
		if (!this.#surreal) {
			throw new Error('Not connected to SurrealDB');
		}
		await this.#surreal.query(`UPDATE account SET type = $type WHERE id = $id`, {
			id: new RecordId('account', accountId),
			type
		});
	}
}
