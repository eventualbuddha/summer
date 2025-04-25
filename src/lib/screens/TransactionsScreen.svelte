<script lang="ts">
	import CategoryPill from '$lib/components/CategoryPill.svelte';
	import Filters from '$lib/components/Filters.svelte';
	import SortHeader from '$lib/components/SortHeader.svelte';
	import TransactionRow from '$lib/components/TransactionRow.svelte';
	import { parseStatement } from '$lib/import';
	import { ImportedTransaction } from '$lib/import/ImportedTransaction';
	import { Statement } from '$lib/import/statement/Statement';
	import { StatementMetadata } from '$lib/import/StatementMetadata';
	import type { State } from '$lib/state.svelte';
	import { formatWholeDollarAmount } from '$lib/utils/formatting';
	import { type Snippet } from 'svelte';
	import { VList } from 'virtua/svelte';
	import IconTallyMark5 from '~icons/mdi/tally-mark-5';
	import IconDollarCoinSolid from '~icons/streamline/dollar-coin-solid';
	import { GlobalWorkerOptions } from 'pdfjs-dist';

	GlobalWorkerOptions.workerSrc = '/pdf.worker.js';

	let { state: s }: { state: State } = $props();

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		// The property can be null when the event is created using the constructor.
		// It is never null when dispatched by the browser.
		event.dataTransfer!.dropEffect = 'copy';
	}

	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		const file = event.dataTransfer?.files?.[0];
		if (file) {
			const data = await file.arrayBuffer();
			const pdf = await Statement.fromPDF(data);
			for (const { source, results } of parseStatement(pdf)) {
				let failed = false;
				let statementMetadata: StatementMetadata | undefined;
				const transactions: ImportedTransaction[] = [];

				for (const result of results) {
					console.log(result);
					if (result.isErr) {
						failed = true;
						console.log(`[${source}]`, result.error);
						break;
					} else if (result.value instanceof ImportedTransaction) {
						transactions.push(result.value);
					} else if (result.value instanceof StatementMetadata) {
						statementMetadata = result.value;
					}
				}

				if (!failed && statementMetadata) {
					await s.importStatement(
						file.name,
						new Uint8Array(data),
						source,
						statementMetadata,
						transactions
					);
					break;
				}
			}
		}
	}
</script>

<title>Transactions – Summer</title>

<div role="region" ondragover={handleDragOver} ondrop={handleDrop} class="h-dvh w-full text-center">
	<div class="flex h-screen w-screen flex-col gap-4 overflow-hidden p-4">
		<div class="flex flex-row items-center gap-4">
			<h1 class="text-2xl font-bold">Transactions</h1>
			{#if s.transactions}
				<span class="flex items-center gap-1 text-sm">
					<IconTallyMark5 />
					{s.transactions.count.toLocaleString()}
				</span>
				<span class="flex items-center gap-1 text-sm">
					<IconDollarCoinSolid />
					{formatWholeDollarAmount(s.transactions.total)}
				</span>
			{/if}
		</div>
		{#if s.filters}
			<Filters
				yearSelections={s.filters.years}
				monthSelections={s.filters.months}
				categorySelections={s.filters.categories}
				accountSelections={s.filters.accounts}
				searchTerm={s.filters.searchTerm}
				selectYears={s.selectYears.bind(s)}
				selectMonths={s.selectMonths.bind(s)}
				selectCategories={s.selectCategories.bind(s)}
				selectAccounts={s.selectAccounts.bind(s)}
				updateSearchTerm={s.updateSearchTerm.bind(s)}
			/>
		{/if}

		<div class="flex min-h-0 flex-row gap-6">
			<div class="flex w-9/12 grow-1 flex-col gap-2 overflow-y-scroll">
				{#if !s.transactions}
					<div class="flex flex-col items-center justify-center">
						<div class="text-2xl font-bold">Loading…</div>
					</div>
				{:else}
					{@const transactions = s.transactions.list}
					<SortHeader sort={s.sort} />
					<VList data={transactions} getKey={(transaction) => transaction.id}>
						{#snippet children(transaction)}
							<TransactionRow
								state={s}
								{transaction}
								categories={s.filters?.categories.map(({ value }) => value) ?? []}
							/>
						{/snippet}
					</VList>
				{/if}
			</div>

			<div class="h-dvh w-3/12 grow-2">
				{#snippet summaryRow(label: Snippet, value: string)}
					<div class="flex flex-row items-baseline gap-0">
						<span class="overflow-hidden overflow-ellipsis whitespace-nowrap"
							>{@render label()}</span
						>
						<span class="grow-1 text-right">{value}</span>
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
						{@render summaryRow(label, formatWholeDollarAmount(total))}
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
	</div>
</div>
