<script lang="ts">
	import BulkTransactionActions from '$lib/components/BulkTransactionActions.svelte';
	import CategoryPill from '$lib/components/CategoryPill.svelte';
	import Filters from '$lib/components/Filters.svelte';
	import ImportButton from '$lib/components/ImportButton.svelte';
	import NavigationButton from '$lib/components/NavigationButton.svelte';
	import SortHeader from '$lib/components/SortHeader.svelte';
	import TransactionRow from '$lib/components/TransactionRow.svelte';
	import type { State } from '$lib/state.svelte';
	import { formatWholeDollarAmount } from '$lib/utils/formatting';
	import { getContext, type Snippet } from 'svelte';
	import { VList } from 'virtua/svelte';
	import IconTallyMark5 from '~icons/mdi/tally-mark-5';
	import IconDollarCoinSolid from '~icons/streamline/dollar-coin-solid';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { untrack } from 'svelte';

	let s: State = getContext('state');

	// Flag to prevent circular updates between URL and state
	let hasInitializedFromUrl = $state(false);

	// Initialize filters from URL once filter options are loaded
	$effect(() => {
		if (!s.filters || hasInitializedFromUrl) return;

		// Wait for filter options to be populated from the database
		if (s.filters.years.length === 0) return;

		const params = $page.url.searchParams;

		// Read years from URL
		const yearsParam = params.get('years');
		if (yearsParam) {
			const selectedYears = new Set(yearsParam.split(','));
			s.filters.years.forEach((y) => {
				y.selected = selectedYears.has(y.key);
			});
		}

		// Read months from URL
		const monthsParam = params.get('months');
		if (monthsParam) {
			const selectedMonths = new Set(monthsParam.split(','));
			s.filters.months.forEach((m) => {
				m.selected = selectedMonths.has(m.key);
			});
		}

		// Read categories from URL
		const categoriesParam = params.get('categories');
		if (categoriesParam) {
			const selectedCategories = new Set(categoriesParam.split(','));
			s.filters.categories.forEach((c) => {
				c.selected = selectedCategories.has(c.key);
			});
		}

		// Read accounts from URL
		const accountsParam = params.get('accounts');
		if (accountsParam) {
			const selectedAccounts = new Set(accountsParam.split(','));
			s.filters.accounts.forEach((a) => {
				a.selected = selectedAccounts.has(a.key);
			});
		}

		// Read search term from URL
		const searchParam = params.get('search');
		if (searchParam) {
			s.filters.searchTerm = searchParam;
		}

		hasInitializedFromUrl = true;
	});

	// Sync filter changes to URL
	$effect(() => {
		if (!s.filters || !hasInitializedFromUrl) return;

		// Track dependencies to trigger effect
		const years = s.filters.years.map((y) => ({ key: y.key, selected: y.selected }));
		const months = s.filters.months.map((m) => ({ key: m.key, selected: m.selected }));
		const categories = s.filters.categories.map((c) => ({ key: c.key, selected: c.selected }));
		const accounts = s.filters.accounts.map((a) => ({ key: a.key, selected: a.selected }));
		const searchTerm = s.filters.searchTerm;

		// Use untrack to read current URL without creating a dependency
		untrack(() => {
			// eslint-disable-next-line svelte/prefer-svelte-reactivity
			const params = new URLSearchParams($page.url.searchParams);

			// Update years parameter
			const selectedYears = years.filter((y) => y.selected).map((y) => y.key);
			const allYears = years.map((y) => y.key);
			if (selectedYears.length > 0 && selectedYears.length < allYears.length) {
				params.set('years', selectedYears.join(','));
			} else {
				params.delete('years');
			}

			// Update months parameter
			const selectedMonths = months.filter((m) => m.selected).map((m) => m.key);
			const allMonths = months.map((m) => m.key);
			if (selectedMonths.length > 0 && selectedMonths.length < allMonths.length) {
				params.set('months', selectedMonths.join(','));
			} else {
				params.delete('months');
			}

			// Update categories parameter
			const selectedCategories = categories.filter((c) => c.selected).map((c) => c.key);
			const allCategories = categories.map((c) => c.key);
			if (selectedCategories.length > 0 && selectedCategories.length < allCategories.length) {
				params.set('categories', selectedCategories.join(','));
			} else {
				params.delete('categories');
			}

			// Update accounts parameter
			const selectedAccounts = accounts.filter((a) => a.selected).map((a) => a.key);
			const allAccounts = accounts.map((a) => a.key);
			if (selectedAccounts.length > 0 && selectedAccounts.length < allAccounts.length) {
				params.set('accounts', selectedAccounts.join(','));
			} else {
				params.delete('accounts');
			}

			// Update search parameter
			if (searchTerm) {
				params.set('search', searchTerm);
			} else {
				params.delete('search');
			}

			// Update URL without triggering navigation
			const newUrl = `${$page.url.pathname}${params.toString() ? '?' + params.toString() : ''}`;
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			goto(newUrl, { replaceState: true, noScroll: true, keepFocus: true });
		});
	});
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
		onclear={() => s.clearFilters()}
	/>
	<BulkTransactionActions />
{/if}

<div class="flex min-h-0 flex-1 flex-row gap-6">
	<div class="flex min-h-0 w-9/12 grow-1 flex-col gap-2">
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

	<div class="min-h-0 w-3/12 grow-2 overflow-y-auto">
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
					`category:${category.id}-summary-value`
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
