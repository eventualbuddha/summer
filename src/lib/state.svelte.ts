import { SvelteDate as Date } from 'svelte/reactivity';
import { Result } from '@badrap/result';
import * as api from './api';
import {
	type Account,
	type Budget,
	type BudgetReportData,
	type Category,
	type Tag,
	type TagReportData,
	type Transaction,
	type Transactions
} from './db';
import type { ImportedTransaction } from './import/ImportedTransaction';
import type { StatementMetadata } from './import/StatementMetadata';
import type { Selection } from './types';
import { Fetcher } from './utils/Fetcher';
import { Filters } from './utils/Filters.svelte';
import { NEVER_PROMISE } from './utils/promises';

export interface FilterState {
	years: Selection<number>[];
	months: Selection<number>[];
	categories: Selection<Category>[];
	accounts: Selection<Account>[];
	searchText: string;
	searchTags: string[];
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
			existing.direction = existing.direction === 'asc' ? 'desc' : 'asc';
		} else {
			this.#columns = [{ field, direction: this.#defaultDirections[field] }];
		}
	}

	addOrToggle(field: SortingField): void {
		const existing = this.#columns.find((c) => c.field === field);
		if (existing) {
			existing.direction = existing.direction === 'asc' ? 'desc' : 'asc';
		} else {
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

	get field(): SortingField {
		return this.#columns[0]?.field ?? this.#defaultField;
	}

	get direction(): SortingDirection {
		return this.#columns[0]?.direction ?? this.#defaultDirections[this.#defaultField];
	}
}

export class State {
	lastError = $state<Error>();
	isConnecting = $state(false);
	#connected = $state(false);

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
		this.#init();

		$effect(() => {
			this.#updateFilters();
		});

		$effect(() => {
			this.#updateTransactions([...this.filters.stickyTransactionIds]);
		});
	}

	async #init() {
		this.isConnecting = true;
		try {
			await this.#updateFilters();
			this.#connected = true;
		} catch (error) {
			console.error('Failed to connect:', error);
			this.lastError = error as Error;
		} finally {
			this.isConnecting = false;
		}
	}

	async #updateFilters() {
		const filterOptions = await api.getFilterOptions();
		this.filters.resetOptions(filterOptions);
		this.defaultCategoryId = await api.getDefaultCategoryId();
		this.tags = await api.getTags();
		this.budgets = await api.getBudgets();
	}

	#getTransactionsFetcher = new Fetcher<
		[params: api.TransactionsQueryParams],
		api.TransactionsQueryResult
	>((params, signal) => api.queryTransactions(params, signal));

	async #updateTransactions(stickyTransactionIds: readonly string[]) {
		if (!this.#connected) return NEVER_PROMISE;

		const { sort } = this;

		const params: api.TransactionsQueryParams = {
			years: this.filters.years
				.filter((selection) => selection.selected)
				.map((selection) => selection.value),
			months: this.filters.months
				.filter((selection) => selection.selected)
				.map((selection) => selection.value),
			categories: this.filters.categories
				.filter((selection) => selection.selected)
				.map((selection) => selection.value.id),
			accounts: this.filters.accounts
				.filter((selection) => selection.selected)
				.map((selection) => selection.value.id),
			searchText: this.filters.searchText,
			searchTags: this.filters.searchTags,
			stickyTransactionIds: [...stickyTransactionIds],
			sort: { columns: [...sort.columns] }
		};

		const result = await this.#getTransactionsFetcher.fetch(params);

		// Parse dates from JSON strings
		const transactions = result.transactions.map((t) => ({
			...t,
			date: new Date(t.date),
			effectiveDate: t.effectiveDate ? new Date(t.effectiveDate) : undefined
		}));

		// Reconstruct the Transactions shape expected by the UI
		const categories = this.filters.categories.filter((s) => s.selected).map((s) => s.value);
		const accounts = this.filters.accounts.filter((s) => s.selected).map((s) => s.value);
		const years = params.years;

		this.transactions = {
			count: transactions.length,
			total: result.total,
			totalByYear: years.map((year) => ({
				year,
				total: result.totalByYear.find((item) => item.year === year)?.total ?? 0
			})),
			totalByCategory: categories.map((category) => ({
				category,
				total: result.totalByCategoryId.find((item) => item.categoryId === category.id)?.total ?? 0
			})),
			totalByAccount: accounts.map((account) => ({
				account,
				total: result.totalByAccountId.find((item) => item.accountId === account.id)?.total ?? 0
			})),
			totalByTag: result.totalByTag.map(({ name, total, totalByYear }) => ({
				tagName: name,
				total,
				totalByYear
			})),
			list: transactions
		};
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

	updateSearchText(searchText: string): void {
		this.#updateFiltersWith((filters) => {
			filters.searchText = searchText;
		});
	}

	updateSearchTags(searchTags: string[]): void {
		this.#updateFiltersWith((filters) => {
			filters.searchTags = searchTags;
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
			filters.searchText = '';
			filters.searchTags = [];
		});
	}

	#updateFiltersWith(callback: (filters: FilterState) => void): void {
		if (!this.filters) return;
		this.filters.stickyTransactionIds.clear();
		callback(this.filters);
	}

	get isConnected() {
		return this.#connected;
	}

	async setCategory(transaction: Transaction, category: Category | undefined) {
		if (!this.filters) {
			throw new Error('No filters have been loaded');
		}

		const oldCategory = transaction.categoryId;
		transaction.categoryId = category?.id;
		try {
			await api.setTransactionCategory(transaction.id, category?.id ?? null);
			this.filters.addStickyTransactionId(transaction.id);
		} catch (error) {
			console.error(error);
			this.lastError = error as Error;
			transaction.categoryId = oldCategory;
		}
	}

	async bulkEdit(
		transactions: readonly Transaction[],
		updates: {
			description?: string;
			categoryId?: string | null;
			effectiveDate?: Date | null;
			tags?: string[];
		}
	): Promise<Result<void>> {
		if (!this.filters) {
			throw new Error('No filters have been loaded');
		}

		type Snapshot = {
			description: string | undefined;
			categoryId: string | undefined;
			effectiveDate: Date | undefined;
			tags: string[];
		};
		const originals = transactions.map(
			(t): Snapshot => ({
				description: t.description,
				categoryId: t.categoryId,
				effectiveDate: t.effectiveDate,
				tags: [...t.tags]
			})
		);

		for (const t of transactions) {
			if ('description' in updates) t.description = updates.description ?? '';
			if ('categoryId' in updates) t.categoryId = updates.categoryId ?? undefined;
			if ('effectiveDate' in updates) t.effectiveDate = updates.effectiveDate ?? undefined;
			if ('tags' in updates) t.tags = updates.tags ?? [];
		}

		try {
			const apiUpdates: Parameters<typeof api.bulkEditTransactions>[1] = {};
			if ('description' in updates) apiUpdates.description = updates.description ?? '';
			if ('categoryId' in updates) apiUpdates.categoryId = updates.categoryId ?? null;
			if ('effectiveDate' in updates)
				apiUpdates.effectiveDate = updates.effectiveDate
					? updates.effectiveDate.toISOString()
					: null;
			if ('tags' in updates) apiUpdates.tags = updates.tags ?? [];

			await api.bulkEditTransactions(
				transactions.map((t) => t.id),
				apiUpdates
			);

			for (const t of transactions) {
				this.filters.addStickyTransactionId(t.id);
			}

			return Result.ok(undefined);
		} catch (error) {
			console.error(error);
			for (let i = 0; i < transactions.length; i++) {
				const t = transactions[i]!;
				const orig = originals[i]!;
				t.description = orig.description;
				t.categoryId = orig.categoryId;
				t.effectiveDate = orig.effectiveDate;
				t.tags = orig.tags;
			}
			return Result.err(error as Error);
		}
	}

	async updateAccountName(accountId: string, name: string) {
		await api.updateAccount(accountId, { name });
		await this.#updateFilters();
	}

	async updateAccountNumber(accountId: string, number?: string) {
		await api.updateAccount(accountId, { number });
		await this.#updateFilters();
	}

	async updateAccountType(accountId: string, type: string) {
		await api.updateAccount(accountId, { type });
		await this.#updateFilters();
	}

	async createCategory(category: Omit<Category, 'id' | 'ordinal'> & { id?: string }) {
		await api.createCategory(category);
		await this.#updateFilters();
	}

	async updateCategoryName(categoryId: string, name: string) {
		await api.updateCategory(categoryId, { name });
		await this.#updateFilters();
	}

	async updateCategoryEmoji(categoryId: string, emoji: string) {
		await api.updateCategory(categoryId, { emoji });
		await this.#updateFilters();
	}

	async updateCategoryColor(categoryId: string, color: string) {
		await api.updateCategory(categoryId, { color });
		await this.#updateFilters();
	}

	async updateDefaultCategoryId(newDefaultCategoryId: string) {
		await api.updateDefaultCategoryId(newDefaultCategoryId);
	}

	async updateDescription(transaction: Transaction, description: string): Promise<Result<void>> {
		const originalDescription = transaction.description;
		transaction.description = description;

		try {
			await api.updateTransactionUserDescription(transaction.id, description);
			return Result.ok(undefined);
		} catch (error) {
			transaction.description = originalDescription;
			return Result.err(error as Error);
		}
	}

	async updateTags(
		transaction: Transaction,
		tags: Transaction['tags'],
		originalTags: Transaction['tags']
	): Promise<Result<void>> {
		const savedTags = transaction.tags;
		transaction.tags = tags;

		try {
			const result = await api.updateTransactionTags(transaction.id, tags, originalTags);
			transaction.tags = result.tags;
			return Result.ok(undefined);
		} catch (error) {
			transaction.tags = savedTags;
			return Result.err(error as Error);
		}
	}

	async updateEffectiveDate(
		transaction: Transaction,
		effectiveDate: Date | null
	): Promise<Result<void>> {
		const original = transaction.effectiveDate;
		transaction.effectiveDate = effectiveDate ?? undefined;

		try {
			await api.updateTransactionEffectiveDate(
				transaction.id,
				effectiveDate ? effectiveDate.toISOString() : null
			);
			this.filters.addStickyTransactionId(transaction.id);
			return Result.ok(undefined);
		} catch (error) {
			transaction.effectiveDate = original;
			return Result.err(error as Error);
		}
	}

	async importStatement(
		filename: string,
		pdfData: Uint8Array,
		source: string,
		metadata: StatementMetadata,
		transactions: readonly ImportedTransaction[]
	): Promise<Result<void>> {
		// Convert PDF data to base64
		let binary = '';
		for (let i = 0; i < pdfData.length; i++) {
			binary += String.fromCharCode(pdfData[i]!);
		}
		const pdfDataBase64 = btoa(binary);

		try {
			const result = await api.importStatement({
				source,
				accountNumber: metadata.account,
				accountName: metadata.accountName,
				accountType: metadata.accountType,
				filename,
				pdfData: pdfDataBase64,
				statementDate: metadata.closingDate.toISO()!,
				transactions: transactions.map((t) => ({
					date: t.date.toISO()!,
					amount: t.amount,
					statementDescription: t.statementDescription,
					type: t.kind
				}))
			});

			await this.#updateFilters();
			this.selectAccounts([result.account.id]);
			const statementDate = new Date(result.statement.date);
			this.selectYears([statementDate.getFullYear().toString()]);
			this.selectMonths([(statementDate.getMonth() + 1).toString()]);
			return Result.ok(undefined);
		} catch (error) {
			return Result.err(error as Error);
		}
	}

	async createBudget(budget: Omit<Budget, 'id'>): Promise<void> {
		await api.createBudget(budget);
		this.budgets = await api.getBudgets();
	}

	async updateBudget(budget: Budget): Promise<void> {
		await api.updateBudget(budget);
		this.budgets = await api.getBudgets();
	}

	async deleteBudget(budgetId: string): Promise<void> {
		await api.deleteBudget(budgetId);
		this.budgets = await api.getBudgets();
	}

	async loadBudgetYears(): Promise<void> {
		this.budgetYears = await api.getBudgetYears();
	}

	async loadBudgetReportData(year?: number): Promise<void> {
		this.budgetReportData = await api.getBudgetReportData(year);
	}

	async loadSingleBudgetReportData(budgetName: string): Promise<void> {
		this.budgetReportData = await api.getSingleBudgetReportData(budgetName);
	}

	async loadTagReportData(): Promise<void> {
		this.tagReportData = await api.getTagReportData();
	}

	async renameTag(tagId: string, name: string): Promise<void> {
		await api.renameTag(tagId, name);
		this.tags = await api.getTags();
	}

	async deleteTag(tagId: string): Promise<void> {
		await api.deleteTag(tagId);
		this.tags = await api.getTags();
	}

	async deleteTags(tagIds: string[]): Promise<void> {
		await Promise.all(tagIds.map((id) => api.deleteTag(id)));
		this.tags = await api.getTags();
	}

	async mergeTags(sourceIds: string[], targetId: string): Promise<void> {
		await api.mergeTags(sourceIds, targetId);
		this.tags = await api.getTags();
	}

	filterByTag(tagName: string): void {
		this.#updateFiltersWith((filters) => {
			for (const yearFilter of filters.years) {
				yearFilter.selected = true;
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
			filters.searchText = '';
			filters.searchTags = [tagName];
		});
	}
}
