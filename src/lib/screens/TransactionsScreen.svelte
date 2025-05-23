<script lang="ts">
	import CategoryPill from '$lib/components/CategoryPill.svelte';
	import Filters from '$lib/components/Filters.svelte';
	import ImportButton from '$lib/components/ImportButton.svelte';
	import NavigationButton from '$lib/components/NavigationButton.svelte';
	import SortHeader from '$lib/components/SortHeader.svelte';
	import TransactionRow from '$lib/components/TransactionRow.svelte';
	import type { State } from '$lib/state.svelte';
	import { formatWholeDollarAmount } from '$lib/utils/formatting';
	import { RecordId } from 'surrealdb';
	import { getContext, type Snippet } from 'svelte';
	import { VList } from 'virtua/svelte';
	import IconTallyMark5 from '~icons/mdi/tally-mark-5';
	import IconDollarCoinSolid from '~icons/streamline/dollar-coin-solid';

	let s: State = getContext('state');
</script>

<title>Transactions – Summer</title>

<div class="flex flex-row items-center gap-4">
	<NavigationButton />
	<h1 class="text-2xl font-bold">Transactions</h1>
	{#if s.transactions}
		<span aria-label="Transaction Count" class="flex items-center gap-1 text-sm">
			<IconTallyMark5 />
			{s.transactions.count.toLocaleString()}
		</span>
		<span aria-label="Transaction Sum" class="flex items-center gap-1 text-sm">
			<IconDollarCoinSolid />
			{formatWholeDollarAmount(s.transactions.total)}
		</span>
	{/if}
	<ImportButton />
</div>
{#if s.filters}
	<Filters
		bind:yearSelections={s.filters.years}
		bind:monthSelections={s.filters.months}
		bind:categorySelections={s.filters.categories}
		bind:accountSelections={s.filters.accounts}
		bind:searchTerm={s.filters.searchTerm}
	/>
{/if}

<div class="flex min-h-0 flex-row gap-6">
	<div class="flex w-9/12 grow-1 flex-col gap-2 overflow-y-scroll">
		{#if !s.transactions}
			<div class="flex flex-col items-center justify-center">
				<div class="text-2xl font-bold">Loading…</div>
			</div>
		{:else}
			<SortHeader sort={s.sort} />
			<VList data={s.transactions.list} getKey={(transaction) => transaction.id}>
				{#snippet children(transaction)}
					<TransactionRow
						{transaction}
						categories={s.filters?.categories.map(({ value }) => value) ?? []}
					/>
				{/snippet}
			</VList>
		{/if}
	</div>

	<div class="h-dvh w-3/12 grow-2">
		{#snippet summaryRow(label: Snippet, value: string, valueTestId?: string)}
			<div class="flex flex-row items-baseline gap-0">
				<span class="overflow-hidden overflow-ellipsis whitespace-nowrap">{@render label()}</span>
				<span class="grow-1 text-right" data-testid={valueTestId}>{value}</span>
			</div>
		{/snippet}
		<h3 class="font-bold">Total by Year</h3>
		{#if !s.transactions}
			{#if s.filters}
				{#each s.filters.years as { value: year, selected } (year)}
					{#if selected}
						{#snippet label()}{year}{/snippet}
						{@render summaryRow(label, '$-')}
					{/if}
				{/each}
			{/if}
		{:else}
			{#each s.transactions.totalByYear as { year, total } (year)}
				{#snippet label()}{year}{/snippet}
				{@render summaryRow(label, formatWholeDollarAmount(total))}
			{/each}
		{/if}

		<h3 class="mt-4 font-bold">Total by Category</h3>
		{#if !s.transactions}
			{#if s.filters}
				{#each s.filters.categories as { value: category, selected } (category.id)}
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
			{/if}
		{:else}
			{#each s.transactions.totalByCategory as { category, total } (category.id)}
				{#snippet label()}
					<CategoryPill
						{category}
						style="full"
						class="overflow-hidden overflow-ellipsis whitespace-nowrap"
					/>
				{/snippet}

				{@render summaryRow(
					label,
					formatWholeDollarAmount(total),
					`${new RecordId('category', category.id)}-summary-value`
				)}
			{/each}
		{/if}

		<h3 class="mt-4 font-bold">Total by Account</h3>
		{#if !s.transactions}
			{#if s.filters}
				{#each s.filters.accounts as { value: account, selected } (account.id)}
					{#if selected}
						{#snippet label()}{account.name}{/snippet}
						{@render summaryRow(label, '$–')}
					{/if}
				{/each}
			{/if}
		{:else}
			{#each s.transactions.totalByAccount as { account, total } (account.id)}
				{#snippet label()}{account.name}{/snippet}
				{@render summaryRow(label, formatWholeDollarAmount(total))}
			{/each}
		{/if}
	</div>
</div>
