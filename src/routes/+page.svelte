<script lang="ts">
	import { goto } from '$app/navigation';
	import CategoryPill from '$lib/components/CategoryPill.svelte';
	import Filters from '$lib/components/Filters.svelte';
	import TransactionDescription from '$lib/components/TransactionDescription.svelte';
	import { type Snippet } from 'svelte';
	import { VList } from 'virtua/svelte';
	import type { PageProps } from './$types';
	import type { QueryParams } from './+page';

	let { data }: PageProps = $props();
	let monthSelections = $state(data.filters.months);
	let yearSelections = $state(data.filters.years);
	let categorySelections = $state(data.filters.categories);
	let accountSelections = $state(data.filters.accounts);

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
		return `${cents <= 0 ? '' : '+'}${(Math.abs(cents) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}`;
	}

	function formatWholeDollarAmount(cents: number): string {
		return `${cents <= 0 ? '' : '+'}${(Math.abs(cents) / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })}`;
	}
</script>

<div class="flex h-screen w-screen flex-col gap-4 overflow-hidden p-4">
	<div class="flex flex-row items-center gap-4">
		<h1 class="text-2xl font-bold">Transactions</h1>
		{#await data.transactions then { count, total }}
			<span class="text-sm">𝍤 {count.toLocaleString()}</span>
			<span class="text-sm">∑ {formatWholeDollarAmount(total)}</span>
		{/await}
	</div>
	<Filters
		bind:yearSelections
		bind:monthSelections
		bind:categorySelections
		bind:accountSelections
	/>

	<div class="flex min-h-0 flex-row gap-6">
		<div class="flex w-9/12 grow-1 flex-col gap-2 overflow-y-scroll">
			{#await data.transactions}
				<div class="flex flex-col items-center justify-center">
					<div class="text-2xl font-bold">Loading…</div>
				</div>
			{:then { list: transactions }}
				<VList data={transactions} getKey={(transaction) => transaction.id}>
					{#snippet children(transaction)}
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
					{/snippet}
				</VList>
			{/await}
		</div>

		<div class="h-dvh w-3/12 max-w-60 grow-2">
			{#snippet summaryRow(label: Snippet, value: string)}
				<div class="flex flex-row items-baseline gap-0">
					<span class="overflow-hidden overflow-ellipsis whitespace-nowrap">{@render label()}</span>
					<span class="grow-1 text-right">{value}</span>
				</div>
			{/snippet}
			<h3 class="font-bold">Total by Year</h3>
			{#await data.transactions}
				{#each data.filters.years as { value: year, selected } (year)}
					{#if selected}
						{#snippet label()}{year}{/snippet}
						{@render summaryRow(label, '$-')}
					{/if}
				{/each}
			{:then { totalByYear }}
				{#each totalByYear as { year, total } (year)}
					{#snippet label()}{year}{/snippet}
					{@render summaryRow(label, formatWholeDollarAmount(total))}
				{/each}
			{/await}

			<h3 class="mt-4 font-bold">Total by Category</h3>
			{#await data.transactions}
				{#each data.filters.categories as { value: category, selected } (category.id)}
					{#if selected}
						{#snippet label()}
							<CategoryPill
								{category}
								style="full"
								class="overflow-hidden overflow-ellipsis whitespace-nowrap"
							/>
						{/snippet}
						{@render summaryRow(label, '$–')}
					{/if}
				{/each}
			{:then { totalByCategory }}
				{#each totalByCategory as { category, total } (category.id)}
					{#snippet label()}
						<CategoryPill
							{category}
							style="full"
							class="overflow-hidden overflow-ellipsis whitespace-nowrap"
						/>
					{/snippet}
					{@render summaryRow(label, formatWholeDollarAmount(total))}
				{/each}
			{/await}

			<h3 class="mt-4 font-bold">Total by Account</h3>
			{#await data.transactions}
				{#each data.filters.accounts as { value: account, selected } (account.id)}
					{#if selected}
						{#snippet label()}{account.name}{/snippet}
						{@render summaryRow(label, '$–')}
					{/if}
				{/each}
			{:then { totalByAccount }}
				{#each totalByAccount as { account, total } (account.id)}
					{#snippet label()}{account.name}{/snippet}
					{@render summaryRow(label, formatWholeDollarAmount(total))}
				{/each}
			{/await}
		</div>
	</div>
</div>
