<script lang="ts">
	import { SvelteDate as Date } from 'svelte/reactivity';
	import type { Category, Transaction } from '$lib/db';
	import type { State } from '$lib/state.svelte';
	import { NONE_CATEGORY } from '$lib/utils/categories';
	import { pluralize } from '$lib/utils/formatting';
	import { getContext, onMount } from 'svelte';
	import CategorySelect from './CategorySelect.svelte';
	import CategoryPill from './CategoryPill.svelte';
	import TagInput from './TagInput.svelte';
	import MonthYearPicker from './MonthYearPicker.svelte';

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

	// Compute common values at mount time (not reactive)
	function getCommonValue<T>(
		values: T[]
	): { common: true; value: T } | { common: false; count: number } {
		const unique = new Set(values.map((v) => JSON.stringify(v)));
		if (unique.size === 1) {
			return { common: true, value: values[0]! };
		}
		return { common: false, count: unique.size };
	}

	const initialDescription = (() => {
		const descs = transactions.map((t) => t.description ?? '');
		return getCommonValue(descs);
	})();

	const initialCategory = (() => {
		const ids = transactions.map((t) => t.categoryId ?? null);
		return getCommonValue(ids);
	})();

	const initialEffectiveDate = (() => {
		const dates = transactions.map((t) =>
			t.effectiveDate ? `${t.effectiveDate.getFullYear()}-${t.effectiveDate.getMonth()}` : null
		);
		return getCommonValue(dates);
	})();

	const initialTags = (() => {
		const tagSets = transactions.map((t) => [...t.tags].sort().join('\0'));
		return getCommonValue(tagSets);
	})();

	// Local edit state
	let descriptionValue = $state(initialDescription.common ? initialDescription.value : '');
	let descriptionDirty = $state(false);

	let selectedCategoryId = $state<string | null | undefined>(
		initialCategory.common ? initialCategory.value : undefined
	);
	let categoryDirty = $state(false);

	// effectiveDateValue: undefined = not set (use statement), { month, year } = set
	const commonEffectiveDateValue = (() => {
		if (!initialEffectiveDate.common) return undefined;
		// Find the actual effective date from a transaction
		const firstTx = transactions[0];
		if (!firstTx?.effectiveDate) return null; // all null = "same as statement"
		return {
			month: firstTx.effectiveDate.getMonth() + 1,
			year: firstTx.effectiveDate.getFullYear()
		};
	})();

	let effectiveDateValue = $state<{ month: number; year: number } | null>(
		initialEffectiveDate.common ? (commonEffectiveDateValue ?? null) : null
	);
	let effectiveDateDirty = $state(false);
	let isPickingEffectiveDate = $state(false);

	const commonTags = (() => {
		if (!initialTags.common) return [];
		return transactions[0]?.tags ?? [];
	})();
	let tagValues = $state<string[]>(initialTags.common ? [...commonTags] : []);
	let tagsDirty = $state(false);

	let isSelectingCategory = $state(false);
	let isSaving = $state(false);
	let modalContent = $state<HTMLDivElement>();
	let portalTarget = $state<HTMLDivElement>();
	let descriptionInput = $state<HTMLInputElement>();

	const transactionCount = $derived(transactions.length);

	const effectiveDateLabel = $derived.by(() => {
		if (!effectiveDateDirty && !initialEffectiveDate.common) {
			return null; // will show placeholder
		}
		if (!effectiveDateValue) return 'Same as statement';
		const d = new Date(effectiveDateValue.year, effectiveDateValue.month - 1, 1);
		return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
	});

	const currentCategoryForDisplay = $derived.by(() => {
		if (!categoryDirty && !initialCategory.common) return null; // multiple
		const id = selectedCategoryId;
		if (id === null || id === undefined) return NONE_CATEGORY;
		return categories.find((c) => c.id === id) ?? NONE_CATEGORY;
	});

	const categoryPlaceholder = $derived.by(() => {
		if (!initialCategory.common) {
			const count = (initialCategory as { common: false; count: number }).count;
			return `${count} ${pluralize(count, 'Category', 'Categories')}`;
		}
		return null;
	});

	const effectiveDatePlaceholder = $derived.by(() => {
		if (!initialEffectiveDate.common) return 'Multiple Dates';
		return null;
	});

	const tagPlaceholder = $derived.by(() => {
		if (!initialTags.common) {
			const count = (initialTags as { common: false; count: number }).count;
			return `Multiple tag sets (${count} unique)`;
		}
		return 'Add tags...';
	});

	onMount(() => {
		const container = document.createElement('div');
		document.body.appendChild(container);
		container.appendChild(portalTarget!);

		setTimeout(() => descriptionInput?.focus(), 0);

		function handleKeydown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				e.preventDefault();
				onclose();
			}
		}
		window.addEventListener('keydown', handleKeydown);

		return () => {
			window.removeEventListener('keydown', handleKeydown);
			container.remove();
		};
	});

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

	function handleDescriptionKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			(e.target as HTMLInputElement).blur();
		}
	}

	function handleTagsChange(updatedTags: string[]) {
		tagValues = updatedTags;
		tagsDirty = true;
	}

	function handleEffectiveDateChange(value: { month: number; year: number } | null) {
		effectiveDateValue = value;
		effectiveDateDirty = true;
		isPickingEffectiveDate = false;
	}

	function handleCategorySelect(category: Category | undefined) {
		selectedCategoryId = category?.id ?? null;
		categoryDirty = true;
		isSelectingCategory = false;
	}

	async function handleSave() {
		isSaving = true;

		const updates: Parameters<typeof s.bulkEdit>[1] = {};

		if (descriptionDirty) {
			updates.description = descriptionValue.trim();
		}

		if (categoryDirty) {
			updates.categoryId = selectedCategoryId ?? null;
		}

		if (effectiveDateDirty) {
			if (effectiveDateValue) {
				updates.effectiveDate = new Date(effectiveDateValue.year, effectiveDateValue.month - 1, 1);
			} else {
				updates.effectiveDate = null;
			}
		}

		if (tagsDirty) {
			updates.tags = tagValues;
		}

		const result = await s.bulkEdit(transactions, updates);
		isSaving = false;

		if (result.isErr) {
			s.lastError = result.error;
		} else {
			onclose();
		}
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
			class="mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
			role="dialog"
			aria-modal="true"
			aria-label="Bulk edit transactions"
		>
			<!-- Header -->
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold">
					Bulk Edit
					<span class="font-normal text-gray-500 dark:text-gray-400">
						— {transactionCount.toLocaleString()}
						{pluralize(transactionCount, 'transaction', 'transactions')}
					</span>
				</h2>
				<button
					type="button"
					onclick={onclose}
					class="cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
					aria-label="Close"
				>
					&times;
				</button>
			</div>

			<!-- Editable fields -->
			<div class="space-y-4">
				<div>
					<label
						for="bulk-description"
						class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
					>
						Description
					</label>
					<input
						bind:this={descriptionInput}
						id="bulk-description"
						type="text"
						class="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
						bind:value={descriptionValue}
						oninput={() => (descriptionDirty = true)}
						onkeydown={handleDescriptionKeydown}
						placeholder={initialDescription.common ? '' : 'Multiple Descriptions'}
						aria-label="Description"
					/>
				</div>

				<div>
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
						Tags
					</label>
					<TagInput
						tags={tagValues}
						availableTags={s.tags}
						onchange={handleTagsChange}
						placeholder={tagPlaceholder}
					/>
				</div>

				<div>
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
						Effective Date
					</label>
					<button
						type="button"
						class="flex w-full cursor-pointer items-center justify-between rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
						onclick={() => (isPickingEffectiveDate = !isPickingEffectiveDate)}
					>
						{#if effectiveDateLabel !== null}
							<span
								class={effectiveDateValue
									? 'text-blue-600 dark:text-blue-400'
									: 'text-gray-500 dark:text-gray-400'}
							>
								{effectiveDateLabel}
							</span>
						{:else}
							<span class="text-gray-400 dark:text-gray-500">{effectiveDatePlaceholder}</span>
						{/if}
					</button>
				</div>

				{#if isPickingEffectiveDate}
					<MonthYearPicker
						value={effectiveDateValue}
						onchange={handleEffectiveDateChange}
						onclose={() => (isPickingEffectiveDate = false)}
					/>
				{/if}

				<div>
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
						Category
					</label>
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div onclick={(e) => e.stopPropagation()}>
						<CategorySelect
							bind:isOpen={isSelectingCategory}
							bind:value={
								() => currentCategoryForDisplay ?? undefined,
								(newCategory) => handleCategorySelect(newCategory)
							}
							{categories}
						>
							{#snippet trigger(isOpen, setIsOpen)}
								<button
									type="button"
									onclick={() => setIsOpen(!isOpen)}
									aria-label="Select category"
									class="flex w-full cursor-pointer items-center justify-between rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
								>
									{#if currentCategoryForDisplay !== null}
										<CategoryPill category={currentCategoryForDisplay} style="full" />
									{:else}
										<span class="text-gray-400 dark:text-gray-500">{categoryPlaceholder}</span>
									{/if}
									<svg class="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
										<path
											fill-rule="evenodd"
											d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
											clip-rule="evenodd"
										/>
									</svg>
								</button>
							{/snippet}
						</CategorySelect>
					</div>
				</div>
			</div>

			<!-- Footer buttons -->
			<div class="mt-6 flex justify-end gap-2">
				<button
					type="button"
					onclick={onclose}
					class="inline-flex cursor-pointer justify-center gap-x-1.5 rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-semibold text-gray-700 shadow-xs hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
				>
					Cancel
				</button>
				<button
					type="button"
					onclick={handleSave}
					disabled={isSaving ||
						(!descriptionDirty && !categoryDirty && !effectiveDateDirty && !tagsDirty)}
					class="inline-flex cursor-pointer justify-center gap-x-1.5 rounded-md bg-blue-600 px-3 py-1 text-sm font-semibold text-white shadow-xs ring-1 ring-blue-600 ring-inset hover:bg-blue-700 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-500 dark:ring-blue-500 hover:dark:bg-blue-600"
				>
					{#if isSaving}
						Saving…
					{:else}
						Update {transactionCount.toLocaleString()}
						{pluralize(transactionCount, 'Transaction', 'Transactions')}
					{/if}
				</button>
			</div>
		</div>
	</div>
</div>
