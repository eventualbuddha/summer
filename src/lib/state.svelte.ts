import { SvelteMap as Map } from 'svelte/reactivity';
import { Result } from '@badrap/result';
import { RecordId, Surreal, Table } from 'surrealdb';
import {
	createBudget,
	deleteBudget,
	getBudgetReportData,
	getBudgets,
	getDefaultCategoryId,
	getFilterOptions,
	getTags,
	getTransactions,
	updateBudget,
	updateDefaultCategoryId,
	use,
	type Account,
	type Budget,
	type BudgetReportData,
	type Category,
	type GetTransactionsOptions,
	type Tag,
	type Transaction,
	type Transactions
} from './db';
import { importStatement } from './db/importStatement';
import { updateTransactionDescription } from './db/updateTransactionDescription';
import type { ImportedTransaction } from './import/ImportedTransaction';
import type { StatementMetadata } from './import/StatementMetadata';
import type { Selection } from './types';
import { Fetcher } from './utils/Fetcher';
import { Filters } from './utils/Filters.svelte';
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
	defaultCategoryId = $state<Category['id']>();
	tags = $state<Tag[]>([]);
	budgets = $state<Budget[]>();
	budgetReportData = $state<BudgetReportData>();

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
		this.defaultCategoryId = await getDefaultCategoryId(this.#surreal);
		this.tags = await getTags(this.#surreal);
		this.budgets = await getBudgets(this.#surreal);
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

	async setBulkCategory(transactions: readonly Transaction[], category: Category | undefined) {
		if (!this.#surreal) {
			throw new Error('Not connected to SurrealDB');
		}

		if (!this.filters) {
			throw new Error('No filters have been loaded');
		}

		// Store original category IDs for rollback on error
		const originalCategories = new Map<string, string | undefined>();
		for (const transaction of transactions) {
			originalCategories.set(transaction.id, transaction.categoryId);
		}

		// Update local state first
		for (const transaction of transactions) {
			transaction.categoryId = category?.id;
		}

		try {
			// Build array of transaction RecordIds
			const transactionIds = transactions.map((t) => new RecordId('transaction', t.id));

			if (category) {
				await this.#surreal.query(`UPDATE $transactions SET category = $category`, {
					transactions: transactionIds,
					category: new RecordId('category', category.id)
				});
			} else {
				await this.#surreal.query(`UPDATE $transactions SET category = none`, {
					transactions: transactionIds
				});
			}

			// Add all transactions to sticky list to keep them visible
			for (const transaction of transactions) {
				this.filters.addStickyTransactionId(transaction.id);
			}
		} catch (error) {
			console.error(error);
			this.lastError = error as Error;

			// Rollback local state changes
			for (const transaction of transactions) {
				transaction.categoryId = originalCategories.get(transaction.id);
			}
		}
	}

	async updateAccountName(accountId: string, name: string) {
		if (!this.#surreal) {
			throw new Error('Not connected to SurrealDB');
		}
		await this.#surreal.query(`UPDATE account SET name = $name WHERE id = $id`, {
			id: new RecordId('account', accountId),
			name
		});
		await this.#updateFilters();
	}

	async updateAccountNumber(accountId: string, number?: string) {
		if (!this.#surreal) {
			throw new Error('Not connected to SurrealDB');
		}
		await this.#surreal.query(`UPDATE account SET number = $number WHERE id = $id`, {
			id: new RecordId('account', accountId),
			number
		});
		await this.#updateFilters();
	}

	async updateAccountType(accountId: string, type: string) {
		if (!this.#surreal) {
			throw new Error('Not connected to SurrealDB');
		}
		await this.#surreal.query(`UPDATE account SET type = $type WHERE id = $id`, {
			id: new RecordId('account', accountId),
			type
		});
		await this.#updateFilters();
	}

	async createCategory(category: Omit<Category, 'id' | 'ordinal'> & { id?: string }) {
		if (!this.#surreal) {
			throw new Error('Not connected to SurrealDB');
		}
		await this.#surreal.create(new Table('category'), category);
		await this.#updateFilters();
	}

	async updateCategoryName(categoryId: string, name: string) {
		if (!this.#surreal) {
			throw new Error('Not connected to SurrealDB');
		}
		await this.#surreal.query(`UPDATE category SET name = $name WHERE id = $id`, {
			id: new RecordId('category', categoryId),
			name
		});
		await this.#updateFilters();
	}

	async updateCategoryEmoji(categoryId: string, emoji: string) {
		if (!this.#surreal) {
			throw new Error('Not connected to SurrealDB');
		}
		await this.#surreal.query(`UPDATE category SET emoji = $emoji WHERE id = $id`, {
			id: new RecordId('category', categoryId),
			emoji
		});
		await this.#updateFilters();
	}

	async updateCategoryColor(categoryId: string, color: string) {
		if (!this.#surreal) {
			throw new Error('Not connected to SurrealDB');
		}
		await this.#surreal.query(`UPDATE category SET color = $color WHERE id = $id`, {
			id: new RecordId('category', categoryId),
			color
		});
		await this.#updateFilters();
	}

	async updateDefaultCategoryId(newDefaultCategoryId: string) {
		if (!this.#surreal) {
			throw new Error('Not connected to SurrealDB');
		}
		await updateDefaultCategoryId(this.#surreal, newDefaultCategoryId);
	}

	async updateTransactionDescription(
		transaction: Transaction,
		description?: string
	): Promise<Result<void>> {
		if (!this.#surreal) {
			throw new Error('Not connected to SurrealDB');
		}

		return await updateTransactionDescription(this.#surreal, transaction, description ?? '');
	}

	async importStatement(
		filename: string,
		pdfData: Uint8Array,
		source: string,
		metadata: StatementMetadata,
		transactions: readonly ImportedTransaction[]
	): Promise<Result<void>> {
		const db = this.#surreal;
		if (!db) {
			throw new Error('Not connected to SurrealDB');
		}

		const result = await importStatement(db, filename, pdfData, source, metadata, transactions);

		if (result.isErr) {
			return Result.err(result.error);
		}

		const { account, statement } = result.value;
		await this.#updateFilters();
		this.selectAccounts([account.id]);
		this.selectYears([statement.date.getFullYear().toString()]);
		this.selectMonths([(statement.date.getMonth() + 1).toString()]);
		return Result.ok(undefined);
	}

	async createBudget(budget: Omit<Budget, 'id'>): Promise<void> {
		if (!this.#surreal) {
			throw new Error('Not connected to SurrealDB');
		}
		await createBudget(this.#surreal, budget);
		this.budgets = await getBudgets(this.#surreal);
	}

	async updateBudget(budget: Budget): Promise<void> {
		if (!this.#surreal) {
			throw new Error('Not connected to SurrealDB');
		}
		await updateBudget(this.#surreal, budget);
		this.budgets = await getBudgets(this.#surreal);
	}

	async deleteBudget(budgetId: string): Promise<void> {
		if (!this.#surreal) {
			throw new Error('Not connected to SurrealDB');
		}
		await deleteBudget(this.#surreal, budgetId);
		this.budgets = await getBudgets(this.#surreal);
	}

	async loadBudgetReportData(): Promise<void> {
		if (!this.#surreal) {
			throw new Error('Not connected to SurrealDB');
		}
		this.budgetReportData = await getBudgetReportData(this.#surreal);
	}
}
