<script lang="ts">
	import { goto } from '$app/navigation';
	import AccountDropdown from '$lib/components/AccountDropdown.svelte';
	import CategoryDropdown from '$lib/components/CategoryDropdown.svelte';
	import CategoryPill from '$lib/components/CategoryPill.svelte';
	import MonthDropdown from '$lib/components/MonthDropdown.svelte';
	import TransactionDescription from '$lib/components/TransactionDescription.svelte';
	import YearDropdown from '$lib/components/YearDropdown.svelte';
	import { type Account, type Category } from '$lib/db';
	import type { Selection } from '$lib/types';
	import type { PageProps } from './$types';
	import type { QueryParams } from './+page';

	let { data }: PageProps = $props();
	let monthSelections: Selection<number>[] = $state(data.monthSelections);
	let yearSelections: Selection<number>[] = $state(data.yearSelections);
	let categorySelections: Selection<Category>[] = $state(data.categorySelections);
	let accountSelections: Selection<Account>[] = $state(data.accountSelections);

	$effect(() => {
		let url = new URL(location.href);
		let searchParams = new URLSearchParams(url.search);
		let hasAllYears = yearSelections.every(({ selected }) => selected);
		let hasAllMonths = monthSelections.every(({ selected }) => selected);
		let hasAllAccounts = accountSelections.every(({ selected }) => selected);
		let hasAllCategories = categorySelections.every(({ selected }) => selected);
		let hasNoFilters = hasAllYears && hasAllMonths && hasAllAccounts && hasAllCategories;

		if (hasNoFilters) {
			searchParams.delete('query');
		} else {
			let query: QueryParams = {};

			if (!hasAllYears) {
				query.years = yearSelections.filter(({ selected }) => selected).map(({ value }) => value);
			}
			if (!hasAllMonths) {
				query.months = monthSelections.filter(({ selected }) => selected).map(({ value }) => value);
			}
			if (!hasAllCategories) {
				query.categories = categorySelections
					.filter(({ selected }) => selected)
					.map(({ value }) => value.id);
			}
			if (!hasAllAccounts) {
				query.accounts = accountSelections
					.filter(({ selected }) => selected)
					.map(({ value }) => value.id);
			}

			searchParams.set('query', btoa(JSON.stringify(query)).replace(/=+$/g, ''));
		}

		url.search = searchParams.toString();
		goto(url.toString(), { replaceState: true });
	});

	function formatTransactionAmount(cents: number): string {
		return `${cents < 0 ? '' : '+'}${(Math.abs(cents) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`;
	}

	function formatWholeDollarAmount(cents: number): string {
		return `${cents < 0 ? '' : '+'}${(Math.abs(cents) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}`;
	}
</script>

<div class="flex h-screen w-screen flex-col gap-4 overflow-hidden p-4">
	<div class="flex flex-row items-center gap-4">
		<h1 class="text-xl font-bold">Transactions</h1>
		<span class="text-sm">𝍤 {data.count.toLocaleString()}</span>
		<span class="text-sm">∑ {formatWholeDollarAmount(data.total)}</span>
	</div>
	<div class="flex flex-row items-center gap-1">
		<span class="font-bold">Filters:</span>
		<YearDropdown aria-label="Year Filter" bind:selections={yearSelections} />
		<MonthDropdown aria-label="Month Filter" bind:selections={monthSelections} />
		<CategoryDropdown aria-label="Category Filter" bind:selections={categorySelections} />
		<AccountDropdown aria-label="Account Filter" bind:selections={accountSelections} />
	</div>

	<div class="flex min-h-0 flex-row gap-6">
		<div class="flex w-9/12 grow-1 flex-col gap-2 overflow-y-scroll">
			{#each data.transactions as transaction (transaction.id)}
				<div class="flex grow-0 flex-row items-center gap-2">
					<div class="text-xs text-gray-600">
						<div class="w-12 text-center">
							{transaction.date.toLocaleDateString(undefined, { month: 'short' })}
							{transaction.date.toLocaleDateString(undefined, { day: 'numeric' })}<br />
							{transaction.date.toLocaleDateString(undefined, { year: 'numeric' })}
						</div>
					</div>
					<CategoryPill category={transaction.category} style="short" />
					<div class="flex-1 overflow-hidden text-lg overflow-ellipsis whitespace-nowrap">
						<TransactionDescription {transaction} />
					</div>
					<div>{formatTransactionAmount(transaction.amount)}</div>
				</div>
			{/each}
		</div>
		<div class="w-3/12 max-w-60 grow-2">
			<h3 class="font-bold">Total by Year</h3>
			{#each data.totalByYear as { year, total } (year)}
				<div class="flex flex-row items-baseline gap-4">
					<span>{year}</span>
					<span class="grow-1 text-right">{formatWholeDollarAmount(total)}</span>
				</div>
			{/each}

			<h3 class="mt-4 font-bold">Total by Category</h3>
			{#each data.totalByCategory as { category, total } (category)}
				<div class="flex flex-row items-baseline gap-0">
					<CategoryPill
						{category}
						style="full"
						class="overflow-hidden overflow-ellipsis whitespace-nowrap"
					/>
					<span class="grow-2 text-right">{formatWholeDollarAmount(total)}</span>
				</div>
			{/each}

			<h3 class="mt-4 font-bold">Total by Account</h3>
			{#each data.totalByAccount as { account, total } (account)}
				<div class="flex flex-row items-baseline gap-4">
					<span class="overflow-hidden overflow-ellipsis whitespace-nowrap">{account.name}</span>
					<span class="grow-1 text-right">{formatWholeDollarAmount(total)}</span>
				</div>
			{/each}
		</div>
	</div>
</div>
