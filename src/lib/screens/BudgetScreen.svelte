<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import BudgetForm from '$lib/components/BudgetForm.svelte';
	import CategoryPill from '$lib/components/CategoryPill.svelte';
	import NavigationButton from '$lib/components/NavigationButton.svelte';
	import type { Budget } from '$lib/db';
	import type { State } from '$lib/state.svelte';
	import { formatWholeDollarAmount } from '$lib/utils/formatting';
	import { getContext } from 'svelte';
	import IconEdit from '~icons/mdi/edit';
	import IconTrash from '~icons/mdi/trash';

	let s: State = getContext('state');

	let isCreatingBudget = $state(false);
	let editingBudget = $state<Budget | null>(null);

	function onClickNewBudget() {
		isCreatingBudget = true;
	}

	function onClickEditBudget(budget: Budget) {
		editingBudget = budget;
	}

	function onClickDeleteBudget(budget: Budget) {
		if (confirm(`Are you sure you want to delete "${budget.name}"?`)) {
			s.deleteBudget(budget.id);
		}
	}

	function onBudgetSaved() {
		isCreatingBudget = false;
		editingBudget = null;
	}

	function onBudgetCancelled() {
		isCreatingBudget = false;
		editingBudget = null;
	}
</script>

<title>Budgets – Summer</title>

<div class="flex flex-row items-center gap-4">
	<NavigationButton />
	<h1 class="text-2xl font-bold">Budgets</h1>
</div>

{#if isCreatingBudget || editingBudget}
	<div class="rounded-lg border border-gray-200 p-6">
		<h2 class="mb-4 text-lg font-semibold">
			{isCreatingBudget ? 'Create New Budget' : `Edit "${editingBudget?.name}"`}
		</h2>
		<BudgetForm
			budget={editingBudget}
			categories={s.filters?.categories.map(({ value }) => value) ?? []}
			onSaved={onBudgetSaved}
			onCancelled={onBudgetCancelled}
		/>
	</div>
{:else}
	<div class="flex gap-2">
		<Button onclick={onClickNewBudget}>New Budget</Button>
	</div>

	{#if !s.budgets}
		<div class="flex flex-col items-center justify-center p-8">
			<div class="text-lg">Loading budgets...</div>
		</div>
	{:else if s.budgets.length === 0}
		<div class="flex flex-col items-center justify-center p-8">
			<div class="text-lg text-gray-600">No budgets created yet</div>
			<div class="mt-2 text-sm text-gray-500">Click "New Budget" to create your first budget</div>
		</div>
	{:else}
		<div class="grid gap-4">
			{#each s.budgets as budget (budget.id)}
				<div class="rounded-lg border border-gray-200 p-6 transition-shadow hover:shadow-sm">
					<div class="mb-4 flex items-start justify-between">
						<div>
							<h3 class="text-lg font-semibold">{budget.name}</h3>
							<p class="text-sm text-gray-600">{budget.year}</p>
						</div>
						<div class="flex gap-2">
							<Button
								onclick={() => onClickEditBudget(budget)}
								class="!p-2"
								aria-label="Edit {budget.name}"
							>
								<IconEdit />
							</Button>
							<Button
								onclick={() => onClickDeleteBudget(budget)}
								class="!bg-red-100 !p-2 !text-red-700 hover:!bg-red-200"
								aria-label="Delete {budget.name}"
							>
								<IconTrash />
							</Button>
						</div>
					</div>

					<div class="mb-4">
						<div class="text-2xl font-bold">
							{formatWholeDollarAmount(budget.amount * 100)}
						</div>
					</div>

					{#if budget.categories.length > 0}
						<div>
							<h4 class="mb-2 text-sm font-medium text-gray-700">Categories</h4>
							<div class="flex flex-wrap gap-1">
								{#each budget.categories as category (category.id)}
									<CategoryPill {category} style="full" />
								{/each}
							</div>
						</div>
					{:else}
						<div class="text-sm text-gray-500">No categories selected</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
{/if}
