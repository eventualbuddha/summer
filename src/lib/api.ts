import type {
	Account,
	Budget,
	BudgetReportData,
	Category,
	FilterOptions,
	Tag,
	TagReportData,
	Transaction
} from './db';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
	const res = await fetch(url, init);
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new Error(body.error || `API error: ${res.status}`);
	}
	if (res.status === 204) return undefined as T;
	return res.json();
}

function postJson<T>(url: string, body: unknown): Promise<T> {
	return fetchJson<T>(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
}

function patchJson<T>(url: string, body: unknown): Promise<T> {
	return fetchJson<T>(url, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body)
	});
}

// Filters
export async function getFilterOptions(): Promise<FilterOptions> {
	const data = await fetchJson<{
		years: number[];
		months: number[];
		categories: Category[];
		accounts: Account[];
	}>('/api/filters');
	return { ...data, searchText: '', searchTags: [] };
}

// Settings
export async function getDefaultCategoryId(): Promise<string | undefined> {
	const { defaultCategoryId } = await fetchJson<{ defaultCategoryId: string | null }>(
		'/api/settings'
	);
	return defaultCategoryId ?? undefined;
}

export async function updateDefaultCategoryId(
	defaultCategoryId: string | undefined
): Promise<void> {
	await patchJson('/api/settings', { defaultCategoryId: defaultCategoryId ?? null });
}

// Tags
export async function getTags(): Promise<Tag[]> {
	return fetchJson<Tag[]>('/api/tags');
}

// Budgets
export async function getBudgets(): Promise<Budget[]> {
	return fetchJson<Budget[]>('/api/budgets');
}

export async function getBudget(id: string): Promise<Budget | null> {
	return fetchJson<Budget>(`/api/budgets/${encodeURIComponent(id)}`).catch(() => null);
}

export async function createBudget(budget: Omit<Budget, 'id'>): Promise<Budget> {
	return postJson<Budget>('/api/budgets', budget);
}

export async function updateBudget(budget: Budget): Promise<Budget> {
	return patchJson<Budget>(`/api/budgets/${encodeURIComponent(budget.id)}`, budget);
}

export async function deleteBudget(id: string): Promise<void> {
	await fetchJson<void>(`/api/budgets/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export async function getBudgetYears(): Promise<number[]> {
	return fetchJson<number[]>('/api/budgets/years');
}

// Categories
export async function getCategories(): Promise<Category[]> {
	return fetchJson<Category[]>('/api/categories');
}

export async function createCategory(
	category: Omit<Category, 'id' | 'ordinal'> & { id?: string }
): Promise<void> {
	await postJson('/api/categories', category);
}

export async function updateCategory(
	id: string,
	fields: Partial<{ name: string; emoji: string; color: string }>
): Promise<void> {
	await patchJson(`/api/categories/${encodeURIComponent(id)}`, fields);
}

// Accounts
export async function getAccounts(): Promise<Account[]> {
	return fetchJson<Account[]>('/api/accounts');
}

export async function updateAccount(
	id: string,
	fields: Partial<{ name: string; number: string; type: string }>
): Promise<void> {
	await patchJson(`/api/accounts/${encodeURIComponent(id)}`, fields);
}

// Transactions
export interface TransactionsQueryResult {
	total: number;
	transactions: Transaction[];
	totalByYear: Array<{ year: number; total: number }>;
	totalByCategoryId: Array<{ categoryId: string; categoryOrdinal: number; total: number }>;
	totalByAccountId: Array<{ accountId: string; total: number }>;
}

export interface TransactionsQueryParams {
	years: number[];
	months: number[];
	categories: string[];
	accounts: string[];
	searchText: string;
	searchTags: string[];
	stickyTransactionIds: string[];
	sort: {
		columns: Array<{ field: string; direction: 'asc' | 'desc' }>;
	};
}

export async function queryTransactions(
	params: TransactionsQueryParams,
	signal?: AbortSignal
): Promise<TransactionsQueryResult> {
	const res = await fetch('/api/transactions/query', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(params),
		signal
	});
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new Error(body.error || `API error: ${res.status}`);
	}
	return res.json();
}

export async function setTransactionCategory(
	transactionId: string,
	categoryId: string | null
): Promise<void> {
	await patchJson(`/api/transactions/${encodeURIComponent(transactionId)}/category`, {
		categoryId
	});
}

export async function setBulkTransactionCategory(
	transactionIds: string[],
	categoryId: string | null
): Promise<void> {
	await patchJson('/api/transactions/bulk-category', { transactionIds, categoryId });
}

// Transaction detail
export interface TransactionDetail {
	accountName: string;
	statementDate: string;
	fileId: string;
}

export async function getTransactionDetail(id: string): Promise<TransactionDetail> {
	return fetchJson<TransactionDetail>(`/api/transactions/${encodeURIComponent(id)}/detail`);
}

export async function updateTransactionUserDescription(
	id: string,
	description: string
): Promise<{ description: string }> {
	return patchJson<{ description: string }>(
		`/api/transactions/${encodeURIComponent(id)}/user-description`,
		{ description }
	);
}

export interface UpdateDescriptionResult {
	tags: string[];
}

export async function updateTransactionEffectiveDate(
	id: string,
	effectiveDate: string | null
): Promise<{ effectiveDate: string | null }> {
	return patchJson<{ effectiveDate: string | null }>(
		`/api/transactions/${encodeURIComponent(id)}/effective-date`,
		{ effectiveDate }
	);
}

export async function updateTransactionTags(
	transactionId: string,
	tags: string[],
	originalTags: string[]
): Promise<UpdateDescriptionResult> {
	return patchJson<UpdateDescriptionResult>(
		`/api/transactions/${encodeURIComponent(transactionId)}/tags`,
		{ tags, originalTags }
	);
}

// Statement import
export interface ImportStatementParams {
	source: string;
	accountNumber: string;
	accountName: string;
	accountType: string;
	filename: string;
	pdfData: string; // base64
	statementDate: string; // ISO date
	transactions: Array<{
		date: string;
		amount: number;
		statementDescription: string;
		type: string;
	}>;
}

export interface ImportStatementResult {
	account: Account;
	statement: { id: string; account: string; date: string; file: string };
}

export async function importStatement(
	params: ImportStatementParams
): Promise<ImportStatementResult> {
	return postJson<ImportStatementResult>('/api/statements/import', params);
}

// Reports
export async function getBudgetReportData(year?: number): Promise<BudgetReportData> {
	const url = year ? `/api/reports/budgets?year=${year}` : '/api/reports/budgets';
	return fetchJson<BudgetReportData>(url);
}

export async function getSingleBudgetReportData(budgetName: string): Promise<BudgetReportData> {
	return fetchJson<BudgetReportData>(`/api/reports/budgets/${encodeURIComponent(budgetName)}`);
}

export async function getTagReportData(): Promise<TagReportData> {
	return fetchJson<TagReportData>('/api/reports/tags');
}
