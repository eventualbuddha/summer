<script lang="ts">
	function formatDate(date: Date): string {
		return date.toLocaleString('en-US', {
			day: 'numeric',
			month: 'numeric',
			year: 'numeric'
		});
	}

	function formatAmount(amount: number): string {
		return amount.toLocaleString('en-US', {
			style: 'currency',
			currency: 'USD'
		});
	}

	interface FilterOptions {
		years: number[];
		categories: string[];
	}

	type FilterState<T extends object> = {
		[K in keyof T]: Array<{
			key: string;
			value: T[K] extends (infer E)[] ? E : never;
			selected: boolean;
		}>;
	};

	interface Transaction {
		id: string;
		date: Date;
		description: string;
		category: string;
		amount: number;
	}

	const TRANSACTIONS: Transaction[] = [
		{
			id: '1',
			date: new Date('2025-04-01'),
			description: 'Hello world',
			category: 'General',
			amount: 123
		},
		{
			id: '2',
			date: new Date('2024-04-01'),
			description: 'Safeway',
			category: 'Grocery',
			amount: 123
		}
	];

	let filterOptions = $state<FilterOptions>();
	let filters = $state<FilterState<FilterOptions>>();

	async function updateFilters() {
		await new Promise((resolve) => {
			setTimeout(resolve, 200);
		});

		filterOptions = {
			years: [2025, 2024],
			categories: ['General', 'Grocery']
		};

		filters = {
			years: filterOptions.years.map(
				(value) =>
					filters?.years.find((year) => year.value === value) ?? {
						key: value.toString(),
						value,
						selected: true
					}
			),
			categories: filterOptions.categories.map(
				(value) =>
					filters?.categories.find((category) => category.value === value) ?? {
						key: value.toString(),
						value,
						selected: true
					}
			)
		};
	}

	let transactions = $derived.by(() => {
		if (!filters) return [];

		const years = filters.years.filter(({ selected }) => selected).map(({ value }) => value);
		const categories = filters.categories
			.filter(({ selected }) => selected)
			.map(({ value }) => value);

		console.log('fetchTransactions', $state.snapshot(filters));
		return TRANSACTIONS.filter(
			(transaction) =>
				years.includes(transaction.date.getFullYear()) && categories.includes(transaction.category)
		);
	});

	// doesn't need onMount
	updateFilters();

	// fetching from server mechanism, limits the surface area of async
	$effect(() => {
		void $state.snapshot(filters);

		// const res = fetch(...)
		// TRANSACTIONS = res.json()
	});
</script>

{#if !filters}
	Loading filters
{:else}
	<div class="m-3 flex flex-row gap-3">
		<div class="flex flex-col">
			{#each filters.years as year (year.key)}
				<label>
					<input type="checkbox" value={year.value} bind:checked={year.selected} />
					{year.value}
				</label>
			{/each}
		</div>
		<div class="flex flex-col">
			{#each filters.categories as category (category.key)}
				<label>
					<input type="checkbox" value={category.value} bind:checked={category.selected} />
					{category.value}
				</label>
			{/each}
		</div>
	</div>
{/if}

{#if !transactions}
	Loading transactions
{:else}
	<div class="flex flex-col">
		{#each transactions as transaction (transaction.id)}
			<div class="flex flex-row gap-2">
				<div>{formatDate(transaction.date)}</div>
				<div>{transaction.description}</div>
				<div>{formatAmount(transaction.amount)}</div>
			</div>
		{/each}
	</div>
{/if}
