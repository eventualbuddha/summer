<script lang="ts">
	import NavigationButton from '$lib/components/NavigationButton.svelte';
	import type { State } from '$lib/state.svelte';
	import { formatWholeDollarAmount } from '$lib/utils/formatting';
	import { getContext } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';

	let s: State = getContext('state');

	function navigateToTransactions(tagName: string, year: number) {
		// Set filters and navigate to transactions screen
		if (s.filters) {
			// Set year filter
			s.filters.years.forEach((y) => {
				y.selected = y.value === year;
			});

			// Select ALL months
			s.filters.months.forEach((m) => {
				m.selected = true;
			});

			// Select ALL categories and accounts
			s.filters.categories.forEach((c) => {
				c.selected = true;
			});
			s.filters.accounts.forEach((a) => {
				a.selected = true;
			});

			// Set search term to the tag with year
			s.filters.searchTerm = `#${tagName}-${year}`;
		}

		goto(resolve('/'));
	}

	let isLoadingTagData = $state(false);

	$effect(() => {
		if (s.isConnected && !s.tagReportData && !isLoadingTagData) {
			isLoadingTagData = true;
			s.loadTagReportData()
				.catch((error) => {
					console.error('Failed to load tag report data:', error);
					s.lastError = error;
				})
				.finally(() => {
					isLoadingTagData = false;
				});
		}
	});

	// Get totals by tag
	const tagTotals = $derived.by(() => {
		if (!s.tagReportData) return {};
		const totals: Record<string, number> = {};
		for (const tagName of s.tagReportData.tagNames) {
			let total = 0;
			for (const year of s.tagReportData.years) {
				total += s.tagReportData.spendingByTagAndYear[tagName]?.[year] || 0;
			}
			totals[tagName] = total;
		}
		return totals;
	});
</script>

<title>Tags – Summer</title>

<div class="flex flex-row items-center gap-4">
	<NavigationButton />
	<h1 class="text-2xl font-bold">Tag Report</h1>
</div>

<div class="flex min-h-0 flex-col overflow-y-auto">
	{#if isLoadingTagData}
		<div class="loading">Loading tag data...</div>
	{:else if !s.tagReportData || s.tagReportData.tagNames.length === 0}
		<div class="no-data">
			<p>No tagged transactions found.</p>
			<p class="hint">
				Tags are created when you add them to transaction descriptions. Use the format
				<code>#tagname-YYYY</code> where YYYY is the year.
			</p>
			<p class="hint">For example: <code>#santa-barbara-2025</code></p>
		</div>
	{:else}
		<div class="table-container">
			<table class="tag-report-table">
				<thead>
					<tr>
						<th class="tag-name-header">Tag</th>
						{#each s.tagReportData.years as year (year)}
							<th class="year-header">{year}</th>
						{/each}
						<th class="total-header">Total</th>
					</tr>
				</thead>
				<tbody>
					{#each s.tagReportData.tagNames as tagName (tagName)}
						<tr class="tag-row">
							<td class="tag-name">#{tagName}</td>
							{#each s.tagReportData.years as year (year)}
								{@const amount = s.tagReportData.spendingByTagAndYear[tagName]?.[year] || 0}
								<td
									class="amount-cell"
									class:has-amount={amount !== 0}
									role="button"
									tabindex="0"
									onclick={() => amount !== 0 && navigateToTransactions(tagName, year)}
									onkeydown={(e) =>
										(e.key === 'Enter' || e.key === ' ') &&
										amount !== 0 &&
										navigateToTransactions(tagName, year)}
								>
									{#if amount !== 0}
										{formatWholeDollarAmount(amount)}
									{:else}
										—
									{/if}
								</td>
							{/each}
							<td class="total-cell">{formatWholeDollarAmount(tagTotals[tagName] || 0)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	.loading,
	.no-data {
		text-align: center;
		padding: 3rem 1rem;
		color: var(--text-secondary);
	}

	.no-data p {
		margin: 0.5rem 0;
	}

	.hint {
		font-size: 0.875rem;
		color: var(--text-tertiary);
	}

	code {
		background: var(--background-secondary);
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
		font-family: monospace;
		font-size: 0.875em;
	}

	.table-container {
		overflow-x: auto;
		border: 1px solid var(--border-color);
		border-radius: 0.5rem;
		background: var(--background);
	}

	.tag-report-table {
		width: 100%;
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
	}

	.tag-report-table thead {
		position: sticky;
		top: 0;
		z-index: 1;
	}

	.tag-report-table th {
		padding: 0.75rem 1rem;
		text-align: right;
		font-weight: 600;
		border-bottom: 2px solid var(--border-color);
		white-space: nowrap;
		box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
	}

	:global(html:not(.dark)) .tag-report-table th {
		background: rgb(55 65 81);
		color: rgb(243 244 246);
	}

	:global(html.dark) .tag-report-table th {
		background: rgb(31 41 55);
		color: rgb(243 244 246);
	}

	.tag-name-header {
		text-align: left;
		position: sticky;
		left: 0;
		z-index: 2;
	}

	.tag-report-table td {
		padding: 0.75rem 1rem;
		text-align: right;
		border-bottom: 1px solid var(--border-color-subtle);
	}

	.tag-name {
		text-align: left;
		font-weight: 500;
		position: sticky;
		left: 0;
		background: var(--background);
		font-family: monospace;
	}

	.tag-row:hover .tag-name {
		background: var(--background-hover);
	}

	.tag-row:hover {
		background: var(--background-hover);
	}

	.amount-cell {
		color: var(--text-secondary);
		transition:
			background 0.15s ease,
			color 0.15s ease;
	}

	.amount-cell.has-amount {
		cursor: pointer;
		color: var(--text-primary);
	}

	.amount-cell.has-amount:hover {
		background: var(--accent-background);
		color: var(--accent-color);
	}

	.amount-cell.has-amount:focus {
		outline: 2px solid var(--accent-color);
		outline-offset: -2px;
	}

	.total-cell {
		font-weight: 600;
		color: var(--text-primary);
		border-left: 1px solid var(--border-color);
	}

	.year-header {
		min-width: 100px;
	}

	.total-header {
		min-width: 120px;
		border-left: 1px solid var(--border-color);
	}
</style>
