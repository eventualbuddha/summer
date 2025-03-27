import { Surreal } from 'surrealdb';
import {
	getFilterOptions,
	getTransactions,
	use,
	type Account,
	type Category,
	type Transactions
} from './db';
import type { Selection } from './types';

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
	db = $state<DatabaseConnectionInfo>();
	lastDb = $state<DatabaseConnectionInfo>();
	connectionError = $state<Error>();
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

	get isConnected() {
		return !!this.#surreal;
	}

	constructor() {
		const lastDb = localStorage.getItem('lastDb');
		if (lastDb) {
			this.lastDb = JSON.parse(lastDb);
		}

		// re-create connection when db info changes
		$effect(() => {
			const { db } = this;

			void (async () => {
				this.#surreal = db
					? await (async ({ url, namespace, database }: DatabaseConnectionInfo) => {
							const surreal = new Surreal();
							await surreal.connect(url);
							await use(surreal, { namespace, database, init: true });

							// if we've successfully connected, set the lastDb and save it to local storage
							this.lastDb = db;
							localStorage.setItem('lastDb', JSON.stringify(db));
							this.connectionError = undefined;

							return surreal;
						})(db)
					: undefined;
			})().catch((error) => {
				this.connectionError = error;
				this.#surreal = undefined;
			});
		});

		// re-create filters when the connection changes
		$effect(() => {
			const db = this.#surreal;
			if (!db) return;

			void (async () => {
				const filters = await getFilterOptions(db);
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
			const db = this.#surreal;
			const { filters, sort } = this;
			if (!db || !filters) return;

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
					db
				);
			})();
		});
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
		const db = new Surreal();
		await db.connect(url);
		await db.use({ namespace, database });
		this.#surreal = db;
	}
}
