<script lang="ts">
	import type { Category, Transaction } from '$lib/db';
	import { NONE_CATEGORY } from '$lib/utils/categories';
	import { formatWholeDollarAmount, pluralize } from '$lib/utils/formatting';
	import Button from './Button.svelte';
	import CategoryPill from './CategoryPill.svelte';

	let {
		transactions,
		targetCategory,
		categories,
		onConfirm,
		onCancel
	}: {
		transactions: readonly Transaction[];
		targetCategory: Category | undefined;
		categories: readonly Category[];
		onConfirm: () => void;
		onCancel: () => void;
	} = $props();

	let confirmButtonElement: HTMLButtonElement;
	let modalContainer: HTMLDivElement;

	// Focus the confirm button whenever the modal is rendered
	$effect(() => {
		// Use setTimeout to ensure the button is rendered before trying to focus it
		setTimeout(() => {
			confirmButtonElement?.focus();
		}, 0);
	});

	// Handle keyboard events
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.preventDefault();
			onCancel();
		}
	}

	interface CategorySummary {
		category: Category | undefined;
		count: number;
		total: number;
	}

	const categorySummaries = $derived.by(() => {
		const summaryMap = new Map<string, CategorySummary>();

		for (const transaction of transactions) {
			const categoryId = transaction.categoryId ?? NONE_CATEGORY.id;
			const category =
				categoryId === NONE_CATEGORY.id ? undefined : categories.find((c) => c.id === categoryId);

			if (!summaryMap.has(categoryId)) {
				summaryMap.set(categoryId, {
					category,
					count: 0,
					total: 0
				});
			}

			const summary = summaryMap.get(categoryId)!;
			summary.count += 1;
			summary.total += transaction.amount;
		}

		// Sort by count descending
		return Array.from(summaryMap.values()).sort((a, b) => b.count - a.count);
	});

	const transactionCount = $derived(transactions.length);
	const targetCategoryName = $derived(
		targetCategory ? `${targetCategory.emoji} ${targetCategory.name}` : NONE_CATEGORY.name
	);
</script>

<!-- Modal backdrop -->
<div
	class="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black"
	onclick={(e) => {
		if (e.target === e.currentTarget) onCancel();
	}}
	onkeydown={handleKeydown}
	role="presentation"
>
	<!-- Modal content -->
	<div
		bind:this={modalContainer}
		class="mx-4 max-h-96 w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 dark:bg-gray-800"
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
	>
		<h2 id="modal-title" class="mb-4 text-xl font-bold">Update Category</h2>

		<p class="mb-4">
			You are about to change the category of {transactionCount}&nbsp;{pluralize(
				transactionCount,
				'transaction',
				'transactions'
			)} to
			<strong>{targetCategoryName}</strong>.
		</p>

		<div class="mb-4">
			<h3 class="mb-2 font-semibold">Current categories:</h3>
			<div class="max-h-40 space-y-2 overflow-y-auto">
				{#each categorySummaries as summary (summary.category?.id)}
					<div class="flex items-center justify-between">
						<div class="flex items-center">
							<CategoryPill category={summary.category ?? NONE_CATEGORY} style="full" />
						</div>
						<div class="text-sm text-gray-600 dark:text-gray-400">
							{summary.count}
							{pluralize(summary.count, 'transaction', 'transactions')},
							{formatWholeDollarAmount(summary.total)}
						</div>
					</div>
				{/each}
			</div>
		</div>

		<div class="flex justify-end gap-2">
			<Button onclick={onCancel}>Cancel</Button>
			<button
				bind:this={confirmButtonElement}
				onclick={onConfirm}
				type="button"
				class="inline-flex cursor-pointer justify-center gap-x-1.5 rounded-md bg-blue-600 px-3 py-1 text-sm font-semibold text-white shadow-xs ring-1 ring-blue-600 ring-inset hover:bg-blue-700 focus:ring-blue-500 disabled:cursor-not-allowed disabled:text-gray-400 dark:bg-blue-500 dark:ring-blue-500 hover:dark:bg-blue-600 disabled:dark:text-gray-600"
			>
				Update {transactionCount}
				{pluralize(transactionCount, 'transaction', 'transactions')}
			</button>
		</div>
	</div>
</div>
