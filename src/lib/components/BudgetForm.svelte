<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import CategoryPill from '$lib/components/CategoryPill.svelte';
	import type { Budget, Category } from '$lib/db';
	import type { State } from '$lib/state.svelte';
	import { pluralize } from '$lib/utils/formatting';
	import { getContext } from 'svelte';

	let {
		budget = null,
		categories = [],
		onSaved,
		onCancelled
	}: {
		budget?: Budget | null;
		categories: Category[];
		onSaved: () => void;
		onCancelled: () => void;
	} = $props();

	let s: State = getContext('state');

	const currentYear = new Date().getFullYear();

	let formData = $state({
		name: budget?.name ?? '',
		year: budget?.year ?? currentYear,
		amount: budget?.amount ? Math.abs(budget.amount) : 0, // Show as positive in form
		selectedCategoryIds: new Set(budget?.categories.map((c) => c.id) ?? [])
	});

	const isFormValid = $derived(formData.name.trim() !== '' && formData.amount > 0);

	function toggleCategory(categoryId: string) {
		if (formData.selectedCategoryIds.has(categoryId)) {
			formData.selectedCategoryIds.delete(categoryId);
		} else {
			formData.selectedCategoryIds.add(categoryId);
		}
		formData.selectedCategoryIds = new Set(formData.selectedCategoryIds);
	}

	async function handleSubmit(event: Event) {
		event.preventDefault();
		if (!isFormValid) return;

		const selectedCategories = categories.filter((c) => formData.selectedCategoryIds.has(c.id));

		const budgetData = {
			name: formData.name.trim(),
			year: formData.year,
			amount: -Math.abs(formData.amount), // Store as negative amount
			categories: selectedCategories
		};

		if (budget) {
			await s.updateBudget({ ...budgetData, id: budget.id });
		} else {
			await s.createBudget(budgetData);
		}

		onSaved();
	}

	// Add global keydown listener when component mounts
	$effect(() => {
		const handleGlobalKeydown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				const activeElement = document.activeElement;
				if (
					activeElement &&
					(activeElement.tagName === 'INPUT' ||
						activeElement.tagName === 'SELECT' ||
						activeElement.tagName === 'TEXTAREA')
				) {
					// Blur the active input/select/textarea
					(activeElement as HTMLElement).blur();
					event.preventDefault();
					return;
				}
				// No input is focused, cancel the form
				event.preventDefault();
				onCancelled();
			} else if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && isFormValid) {
				event.preventDefault();
				handleSubmit(event);
			}
		};

		document.addEventListener('keydown', handleGlobalKeydown);

		return () => {
			document.removeEventListener('keydown', handleGlobalKeydown);
		};
	});
</script>

<form onsubmit={handleSubmit} class="space-y-6">
	<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
		<div class="space-y-4">
			<div>
				<label for="budget-name" class="mb-1 block text-sm font-medium text-gray-700">
					Budget Name
				</label>
				<input
					id="budget-name"
					type="text"
					bind:value={formData.name}
					placeholder="e.g., 2025 Household Budget"
					required
					class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
				/>
			</div>

			<div>
				<label for="budget-amount" class="mb-1 block text-sm font-medium text-gray-700">
					Budget Amount ($)
				</label>
				<input
					id="budget-amount"
					type="number"
					min="0"
					step="0.01"
					bind:value={formData.amount}
					placeholder="1000.00"
					required
					class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
				/>
			</div>

			<div>
				<label
					for="year-select"
					class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
				>
					Year
				</label>
				<select
					id="year-select"
					bind:value={formData.year}
					class="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200"
				>
					{#each Array.from({ length: 10 }, (_, i) => currentYear - 5 + i) as year (year)}
						<option value={year}>{year}</option>
					{/each}
				</select>
			</div>
		</div>

		<div>
			<h3 class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">Categories</h3>

			{#if categories.length === 0}
				<div class="text-sm text-gray-500 italic">
					No categories available. Create categories first to assign them to budgets.
				</div>
			{:else}
				<div
					class="max-h-60 space-y-2 overflow-y-auto rounded-md border border-gray-200 p-3 dark:border-gray-600 dark:bg-gray-800"
				>
					{#each categories as category (category.id)}
						<label
							class="flex cursor-pointer items-center gap-3 rounded-md p-2 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
						>
							<input
								type="checkbox"
								checked={formData.selectedCategoryIds.has(category.id)}
								onchange={() => toggleCategory(category.id)}
								class="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
								aria-describedby="category-{category.id}-description"
							/>
							<CategoryPill {category} style="full" />
							<span id="category-{category.id}-description" class="sr-only">
								{category.name} category
							</span>
						</label>
					{/each}
				</div>

				<div class="mt-2 text-sm text-gray-600">
					{formData.selectedCategoryIds.size}
					{pluralize(formData.selectedCategoryIds.size, 'category', 'categories')} selected
				</div>
			{/if}
		</div>
	</div>

	<div class="flex gap-3 border-t border-gray-200 pt-4">
		<button
			type="submit"
			disabled={!isFormValid}
			class="inline-flex cursor-pointer justify-center gap-x-1.5 rounded-md bg-blue-600 px-3 py-1 text-sm font-semibold text-white shadow-xs ring-1 ring-blue-600 ring-inset hover:bg-blue-700 focus:ring-blue-500 disabled:cursor-not-allowed disabled:text-gray-400 dark:bg-blue-500 dark:ring-blue-500 hover:dark:bg-blue-600 disabled:dark:text-gray-600"
		>
			{budget ? 'Update Budget' : 'Create Budget'}
		</button>
		<Button type="button" onclick={onCancelled}>Cancel</Button>
	</div>
</form>
