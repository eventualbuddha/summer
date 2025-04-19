import { RecordId, Surreal } from 'surrealdb';
import {
	getFilterOptions,
	getTransactions,
	use,
	type Account,
	type Category,
	type Transaction,
	type Transactions
} from './db';
import type { Selection } from './types';

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

	filters = $state<FilterState>();
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
	transactions = $state<Transactions>();

	constructor() {
		const lastDb = localStorage.getItem(LOCAL_STORAGE_KEY);
		if (lastDb) {
			this.lastDb = JSON.parse(lastDb);
		}

		// re-create filters when the connection changes
		$effect(() => {
			const surreal = this.#surreal;
			if (!surreal) return;

			void (async () => {
				const filters = await getFilterOptions(surreal);
				this.filters = {
					years: filters.years.map((year) => ({
						key: year.toString(),
						value: year,
						selected: true
					})),
					months: filters.months.map((month) => ({
						key: month.toString(),
						value: month,
						selected: true
					})),
					categories: filters.categories.map((category) => ({
						key: category.id,
						value: category,
						selected: true
					})),
					accounts: filters.accounts.map((account) => ({
						key: account.id,
						value: account,
						selected: true
					})),
					searchTerm: ''
				};
			})();
		});

		// fetch transactions when the connection or filters change
		$effect(() => {
			const surreal = this.#surreal;
			const { filters, sort } = this;
			if (!surreal || !filters) return;

			void (async () => {
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
						sort
					},
					surreal
				);
			})();
		});
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
		} catch (error) {
			console.error(error);
			this.lastError = error as Error;
			transaction.category = oldCategory;
		}
	}
}
