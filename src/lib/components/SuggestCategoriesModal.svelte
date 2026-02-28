<script lang="ts">
	import type { Category, Transaction } from '$lib/db';
	import type { State } from '$lib/state.svelte';
	import { suggestCategories, type CategorySuggestion } from '$lib/api';
	import { formatTransactionAmount, pluralize } from '$lib/utils/formatting';
	import { getContext, onMount } from 'svelte';
	import CategoryPill from './CategoryPill.svelte';

	type ModalState = 'loading' | 'loaded' | 'applying';

	interface SuggestionItem {
		suggestion: CategorySuggestion;
		transaction: Transaction;
		category: Category;
		checked: boolean;
	}

	const HIGH_CONFIDENCE = 0.8;

	let s: State = getContext('state');

	let {
		transactions,
		categories,
		onclose
	}: {
		transactions: readonly Transaction[];
		categories: readonly Category[];
		onclose: () => void;
	} = $props();

	let modalState = $state<ModalState>('loading');
	let items = $state<SuggestionItem[]>([]);
	let portalTarget = $state<HTMLDivElement>();
	let modalContent = $state<HTMLDivElement>();

	const checkedCount = $derived(items.filter((item) => item.checked).length);

	onMount(() => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		container.appendChild(portalTarget!);

		function handleKeydown(e: KeyboardEvent) {
			const activeElement = document.activeElement;
			const isTypingElement =
				activeElement instanceof HTMLInputElement ||
				activeElement instanceof HTMLTextAreaElement ||
				activeElement instanceof HTMLSelectElement ||
				(activeElement instanceof HTMLElement && activeElement.isContentEditable);

			if (e.key === 'Escape') {
				e.preventDefault();
				onclose();
				return;
			}

			if (e.key.toLowerCase() === 'q' && !isTypingElement) {
				e.preventDefault();
				onclose();
			}
		}
		window.addEventListener('keydown', handleKeydown);

		loadSuggestions();

		return () => {
			window.removeEventListener('keydown', handleKeydown);
			container.remove();
		};
	});

	async function loadSuggestions() {
		modalState = 'loading';
		const transactionIds = transactions.map((t) => t.id);
		const suggestions = await suggestCategories(transactionIds);

		const txById = new Map(transactions.map((t) => [t.id, t]));

		items = suggestions
			.map((suggestion): SuggestionItem | null => {
				const tx = txById.get(suggestion.transactionId);
				const cat = categories.find((c) => c.id === suggestion.suggestedCategoryId);
				if (!tx || !cat) return null;
				return {
					suggestion,
					transaction: tx,
					category: cat,
					checked: suggestion.confidence >= HIGH_CONFIDENCE
				};
			})
			.filter((item): item is SuggestionItem => item !== null);

		modalState = 'loaded';
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}

	function handleTabKeydown(e: KeyboardEvent) {
		if (e.key === 'Tab') {
			const focusable = modalContent?.querySelectorAll<HTMLElement>(
				'input, button, select, [tabindex]:not([tabindex="-1"])'
			);
			if (!focusable || focusable.length === 0) return;
			const first = focusable[0]!;
			const last = focusable[focusable.length - 1]!;
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		}
	}

	async function handleApply() {
		const checked = items.filter((item) => item.checked);
		if (checked.length === 0) return;

		modalState = 'applying';

		// Group by suggested category
		const byCategory: Record<string, Transaction[]> = {};
		for (const item of checked) {
			const catId = item.suggestion.suggestedCategoryId;
			(byCategory[catId] ??= []).push(item.transaction);
		}

		for (const [categoryId, txs] of Object.entries(byCategory)) {
			const result = await s.bulkEdit(txs, { categoryId });
			if (result.isErr) {
				s.lastError = result.error;
				modalState = 'loaded';
				return;
			}
		}

		onclose();
	}

	function formatDate(date: Date): string {
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function formatFullDate(date: Date): string {
		return date.toLocaleDateString('en-US', {
			weekday: 'long',
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});
	}

	function formatConfidence(confidence: number): string {
		return `${Math.round(confidence * 100)}%`;
	}

	function formatConfidenceTitle(item: SuggestionItem): string {
		const matchingCount = Math.round(item.suggestion.confidence * item.suggestion.matchCount);
		const total = item.suggestion.matchCount;
		return `${matchingCount} of ${total} historical ${pluralize(total, 'transaction', 'transactions')} with this description were categorized as "${item.category.name}"`;
	}
</script>

<div bind:this={portalTarget}>
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		onclick={handleBackdropClick}
		onkeydown={handleTabKeydown}
		role="presentation"
	>
		<div
			bind:this={modalContent}
			class="mx-4 flex w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl dark:bg-gray-800"
			style="max-height: 80vh"
			role="dialog"
			aria-modal="true"
			aria-label="Suggest categories"
		>
			<!-- Header -->
			<div
				class="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-700"
			>
				<h2 class="text-lg font-semibold">Suggest Categories</h2>
				<button
					type="button"
					onclick={onclose}
					class="cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
					aria-label="Close"
				>
					&times;
				</button>
			</div>

			<!-- Body -->
			<div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
				{#if modalState === 'loading'}
					<p class="text-sm text-gray-500 dark:text-gray-400">Finding suggestions…</p>
				{:else if items.length === 0}
					<p class="text-sm text-gray-500 dark:text-gray-400">
						No suggestions found. Categorize more transactions to build your history.
					</p>
				{:else}
					<p class="mb-3 text-sm text-gray-500 dark:text-gray-400">
						Found {items.length}
						{pluralize(items.length, 'suggestion', 'suggestions')} for {transactions.length}
						{pluralize(transactions.length, 'transaction', 'transactions')}
					</p>
					<div class="space-y-1">
						{#each items as item (item.transaction.id)}
							<label
								class="flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700/50"
							>
								<input
									type="checkbox"
									bind:checked={item.checked}
									disabled={modalState === 'applying'}
									class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600"
								/>
								<span
									class="w-12 shrink-0 text-xs text-gray-400 dark:text-gray-500"
									title={formatFullDate(item.transaction.effectiveDate ?? item.transaction.date)}
								>
									{formatDate(item.transaction.effectiveDate ?? item.transaction.date)}
								</span>
								<span
									class="w-16 shrink-0 text-right text-xs text-gray-600 tabular-nums dark:text-gray-400"
								>
									{formatTransactionAmount(item.transaction.amount)}
								</span>
								<span
									class="min-w-0 flex-1 truncate text-sm"
									title={item.transaction.statementDescription}
								>
									{item.transaction.description ?? item.transaction.statementDescription}
								</span>
								<span class="flex w-40 shrink-0 items-center">
									<CategoryPill category={item.category} style="full" />
								</span>
								<span
									class="w-10 shrink-0 text-right text-xs tabular-nums {item.suggestion
										.confidence >= HIGH_CONFIDENCE
										? 'text-green-600 dark:text-green-400'
										: 'text-yellow-600 dark:text-yellow-400'}"
									title={formatConfidenceTitle(item)}
								>
									{formatConfidence(item.suggestion.confidence)}
								</span>
							</label>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Footer -->
			<div class="flex justify-end gap-2 border-t border-gray-200 px-6 py-4 dark:border-gray-700">
				<button
					type="button"
					onclick={onclose}
					class="inline-flex cursor-pointer justify-center gap-x-1.5 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-semibold text-gray-700 shadow-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
				>
					Cancel
				</button>
				{#if modalState !== 'loading' && items.length > 0}
					<button
						type="button"
						onclick={handleApply}
						disabled={modalState === 'applying' || checkedCount === 0}
						class="inline-flex cursor-pointer justify-center gap-x-1.5 rounded-md bg-blue-600 px-3 py-1 text-sm font-semibold text-white shadow-xs ring-1 ring-blue-600 ring-inset hover:bg-blue-700 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:ring-blue-500 hover:dark:bg-blue-600"
					>
						{#if modalState === 'applying'}
							Applying…
						{:else}
							Apply {checkedCount} Checked {pluralize(checkedCount, 'Suggestion', 'Suggestions')}
						{/if}
					</button>
				{/if}
			</div>
		</div>
	</div>
</div>
