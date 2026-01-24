import { SvelteMap as Map } from 'svelte/reactivity';
import { Result } from '@badrap/result';
import { ConnectionStatus, RecordId, Surreal, Table } from 'surrealdb';
import {
	createBudget,
	deleteBudget,
	getBudgetReportData,
	getBudgetYears,
	getBudgets,
	getDefaultCategoryId,
	getFilterOptions,
	getSingleBudgetReportData,
	getTagReportData,
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
	type TagReportData,
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
const RECENT_CONNECTIONS_KEY = 'recentConnections';
const MAX_RECENT_CONNECTIONS = 4;

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

export interface SortColumn {
	field: SortingField;
	direction: SortingDirection;
}

export interface FieldSortInfo {
	direction: SortingDirection;
	priority: number;
}

export class Sorting {
	#defaultField: SortingField;
	#columns = $state<SortColumn[]>([]);
	#defaultDirections: Record<SortingField, SortingDirection>;

	constructor(
		defaultDirections: Record<SortingField, SortingDirection>,
		defaultField: SortingField
	) {
		this.#defaultField = defaultField;
		this.#defaultDirections = defaultDirections;
		this.#columns = [{ field: defaultField, direction: defaultDirections[defaultField] }];
	}

	sortBy(field: SortingField): void {
		const existing = this.#columns.find((c) => c.field === field);
		if (this.#columns.length === 1 && existing) {
			// Toggle direction if already the sole sort column
			existing.direction = existing.direction === 'asc' ? 'desc' : 'asc';
		} else {
			// Replace all sorts with single column using default direction
			this.#columns = [{ field, direction: this.#defaultDirections[field] }];
		}
	}

	addOrToggle(field: SortingField): void {
		const existing = this.#columns.find((c) => c.field === field);
		if (existing) {
			// Toggle direction in place
			existing.direction = existing.direction === 'asc' ? 'desc' : 'asc';
		} else {
			// Add new column to end with default direction
			this.#columns.push({ field, direction: this.#defaultDirections[field] });
		}
	}

	fieldSort(field: SortingField): FieldSortInfo | undefined {
		const index = this.#columns.findIndex((c) => c.field === field);
		if (index === -1) return undefined;
		return {
			direction: this.#columns[index]!.direction,
			priority: index + 1
		};
	}

	get columns(): readonly SortColumn[] {
		return this.#columns;
	}

	// Backward-compatible getters for primary sort
	get field(): SortingField {
		return this.#columns[0]?.field ?? this.#defaultField;
	}

	get direction(): SortingDirection {
		return this.#columns[0]?.direction ?? this.#defaultDirections[this.#defaultField];
	}
}

export class State {
	lastDb = $state<DatabaseConnectionInfo>();
	recentConnections = $state<DatabaseConnectionInfo[]>([]);
	lastError = $state<Error>();
	#surreal = $state<Surreal>();
	isConnecting = $state(false);
	#reconnectAttempts = 0;
	#maxReconnectAttempts = 5;
	#reconnectTimeoutId: ReturnType<typeof setTimeout> | undefined;
	#isIntentionalDisconnect = false;

	filters = $state(new Filters());
	transactions = $state<Transactions>();
	defaultCategoryId = $state<Category['id']>();
	tags = $state<Tag[]>([]);
	budgets = $state<Budget[]>();
	budgetReportData = $state<BudgetReportData>();
	budgetYears = $state<number[]>();
	tagReportData = $state<TagReportData>();

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
			const parsedDb = JSON.parse(lastDb) as DatabaseConnectionInfo;
			this.lastDb = parsedDb;
			// Auto-connect to last database
			this.connect(parsedDb).catch((error) => {
				console.error('Auto-connect failed:', error);
				this.lastError = error as Error;
			});
		}

		// Load recent connections
		const recentConnectionsJson = localStorage.getItem(RECENT_CONNECTIONS_KEY);
		if (recentConnectionsJson) {
			this.recentConnections = JSON.parse(recentConnectionsJson) as DatabaseConnectionInfo[];
		}

		// Listen for browser visibility changes (computer wake/sleep)
		if (typeof document !== 'undefined') {
			document.addEventListener('visibilitychange', () => {
				if (document.visibilityState === 'visible') {
					this.#handleBrowserResume();
				}
			});

			// Listen for page show event (back button, etc)
			window.addEventListener('pageshow', (event) => {
				// If page was restored from bfcache (back-forward cache)
				if (event.persisted) {
					this.#handleBrowserResume();
				}
			});
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

	clearFilters(): void {
		this.#updateFiltersWith((filters) => {
			const maxYear = Math.max(...filters.years.map((y) => y.value));
			for (const yearFilter of filters.years) {
				yearFilter.selected = yearFilter.value === maxYear;
			}
			for (const monthFilter of filters.months) {
				monthFilter.selected = true;
			}
			for (const categoryFilter of filters.categories) {
				categoryFilter.selected = true;
			}
			for (const accountFilter of filters.accounts) {
				accountFilter.selected = true;
			}
			filters.searchTerm = '';
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
		this.isConnecting = true;
		this.lastError = undefined;

		// Clear old data when switching connections
		this.transactions = undefined;
		this.defaultCategoryId = undefined;
		this.tags = [];
		this.budgets = undefined;
		this.budgetReportData = undefined;
		this.tagReportData = undefined;

		try {
			const surreal = new Surreal();
			await surreal.connect(url);
			await use(surreal, { namespace, database, init: true });

			const connectionInfo = {
				url,
				namespace,
				database
			};

			localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(connectionInfo));

			this.lastDb = connectionInfo;
			this.#surreal = surreal;
			this.#reconnectAttempts = 0; // Reset reconnect attempts on successful connection

			// Set up connection event listeners
			this.#setupConnectionListeners(surreal);

			// Update recent connections list
			this.#addToRecentConnections(connectionInfo);
		} catch (error) {
			console.error('Connection failed:', error);
			this.lastError = error as Error;
			throw error; // Re-throw so callers can handle it
		} finally {
			this.isConnecting = false;
		}
	}

	#addToRecentConnections(connection: DatabaseConnectionInfo) {
		// Remove duplicate if it exists
		const filtered = this.recentConnections.filter(
			(c) =>
				!(
					c.url === connection.url &&
					c.namespace === connection.namespace &&
					c.database === connection.database
				)
		);

		// Add to front of list
		const updated = [connection, ...filtered].slice(0, MAX_RECENT_CONNECTIONS);

		this.recentConnections = updated;
		localStorage.setItem(RECENT_CONNECTIONS_KEY, JSON.stringify(updated));
	}

	#setupConnectionListeners(surreal: Surreal) {
		// Listen for disconnection events
		surreal.emitter.subscribe('disconnected', () => {
			// Don't reconnect if this was an intentional disconnect
			if (this.#isIntentionalDisconnect) {
				this.#isIntentionalDisconnect = false;
				return;
			}
			console.warn('SurrealDB connection disconnected, attempting to reconnect...');
			this.#attemptReconnect();
		});

		// Listen for error events
		surreal.emitter.subscribe('error', (error) => {
			console.error('SurrealDB connection error:', error);
			this.lastError = error;
		});

		// Listen for successful reconnection
		surreal.emitter.subscribe('connected', () => {
			console.log('SurrealDB connection established');
			this.#reconnectAttempts = 0; // Reset on successful connection
		});
	}

	#handleBrowserResume() {
		const surreal = this.#surreal;
		if (!surreal || !this.lastDb) return;

		// Check connection status
		if (
			surreal.status === ConnectionStatus.Disconnected ||
			surreal.status === ConnectionStatus.Error
		) {
			console.log('Browser resumed, connection lost. Attempting to reconnect...');
			this.#attemptReconnect();
		} else {
			// Ping to verify connection is still alive
			surreal.ping().catch((error) => {
				console.warn('Ping failed after browser resume:', error);
				this.#attemptReconnect();
			});
		}
	}

	#attemptReconnect() {
		// Clear any existing reconnect timeout
		if (this.#reconnectTimeoutId) {
			clearTimeout(this.#reconnectTimeoutId);
		}

		const lastDb = this.lastDb;
		if (!lastDb) {
			console.warn('No previous connection info available for reconnection');
			return;
		}

		if (this.#reconnectAttempts >= this.#maxReconnectAttempts) {
			console.error('Max reconnection attempts reached');
			this.lastError = new Error('Failed to reconnect to SurrealDB after multiple attempts');
			return;
		}

		// Exponential backoff: 1s, 2s, 4s, 8s, 16s
		const delay = Math.min(1000 * Math.pow(2, this.#reconnectAttempts), 16000);
		this.#reconnectAttempts++;

		console.log(
			`Reconnect attempt ${this.#reconnectAttempts}/${this.#maxReconnectAttempts} in ${delay}ms...`
		);

		this.#reconnectTimeoutId = setTimeout(() => {
			this.connect(lastDb).catch((error) => {
				console.error('Reconnection attempt failed:', error);
				// The connect method will have set lastError
				// Try again
				this.#attemptReconnect();
			});
		}, delay);
	}

	disconnect() {
		// Mark this as an intentional disconnect to prevent auto-reconnect
		this.#isIntentionalDisconnect = true;

		// Clear any pending reconnection attempts
		if (this.#reconnectTimeoutId) {
			clearTimeout(this.#reconnectTimeoutId);
			this.#reconnectTimeoutId = undefined;
		}
		this.#reconnectAttempts = 0;

		if (this.#surreal) {
			this.#surreal.close();
			this.#surreal = undefined;
		}
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

	async loadBudgetYears(): Promise<void> {
		if (!this.#surreal) {
			throw new Error('Not connected to SurrealDB');
		}
		this.budgetYears = await getBudgetYears(this.#surreal);
	}

	async loadBudgetReportData(year?: number): Promise<void> {
		if (!this.#surreal) {
			throw new Error('Not connected to SurrealDB');
		}
		this.budgetReportData = await getBudgetReportData(this.#surreal, year);
	}

	async loadSingleBudgetReportData(budgetName: string): Promise<void> {
		if (!this.#surreal) {
			throw new Error('Not connected to SurrealDB');
		}
		this.budgetReportData = await getSingleBudgetReportData(this.#surreal, budgetName);
	}

	async loadTagReportData(): Promise<void> {
		if (!this.#surreal) {
			throw new Error('Not connected to SurrealDB');
		}
		this.tagReportData = await getTagReportData(this.#surreal);
	}
}
