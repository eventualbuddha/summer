<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import ButtonLike from '$lib/components/ButtonLike.svelte';
	import CategoryPill from '$lib/components/CategoryPill.svelte';
	import NavigationButton from '$lib/components/NavigationButton.svelte';
	import type { Category } from '$lib/db';
	import type { State } from '$lib/state.svelte';
	import { getContext } from 'svelte';

	let s: State = getContext('state');

	const TEMPLATE_CATEGORY: Partial<Category> = {};

	let isCreatingCategory = $state(false);
	let newCategory: Partial<Category> = $state({ ...TEMPLATE_CATEGORY });

	function onClickNewCategory() {
		isCreatingCategory = true;
	}

	function onClickSaveCategory() {
		const { id, name, emoji, color } = newCategory;
		if (!name || !emoji || !color) {
			throw new Error('Not all category properties are set');
		}

		s.createCategory({ id, name, emoji, color });
		isCreatingCategory = false;
		newCategory = { ...TEMPLATE_CATEGORY };
	}

	function onClickCancelCreate() {
		isCreatingCategory = false;
		newCategory = { ...TEMPLATE_CATEGORY };
	}

	const COLORS = [
		{ value: 'amber-400', label: 'Amber' },
		{ value: 'blue-200', label: 'Dim Blue' },
		{ value: 'blue-300', label: 'Blue' },
		{ value: 'fuchsia-200', label: 'Fuchsia' },
		{ value: 'green-200', label: 'Dim Green' },
		{ value: 'green-300', label: 'Green' },
		{ value: 'orange-200', label: 'Orange' },
		{ value: 'purple-200', label: 'Purple' },
		{ value: 'red-200', label: 'Red' },
		{ value: 'yellow-200', label: 'Dim Yellow' },
		{ value: 'yellow-300', label: 'Yellow' },
		{ value: 'gray-300', label: 'Gray' }
	];
</script>

<div class="flex flex-row items-center gap-4">
	<NavigationButton />
	<h1 class="text-2xl font-bold">Categories</h1>
</div>

<label>
	<span class="font-bold">Default category:</span>
	<ButtonLike>
		{#snippet children(classNames)}
			<select
				class={classNames}
				value={s.defaultCategoryId}
				onchange={(event) => s.updateDefaultCategoryId(event.currentTarget.value)}
			>
				<option value="" disabled>Select Category</option>
				{#each s.filters.categories as category (category.value.id)}
					<option value={category.value.id}>{category.value.emoji} {category.value.name}</option>
				{/each}
			</select>
		{/snippet}
	</ButtonLike>
</label>

<table class="table-fixed">
	<thead>
		<tr class="text-left">
			<th>Emoji</th>
			<th>Name</th>
			<th>Color</th>
			<th>ID</th>
		</tr>
	</thead>
	<tbody>
		{#each s.filters.categories as category (category.value.id)}
			<tr>
				<td aria-label="Category Emoji" class="max-w-6">
					<CategoryPill category={category.value} style="color" />
					<input
						type="text"
						value={category.value.emoji}
						onchange={(event) =>
							s.updateCategoryEmoji(category.value.id, event.currentTarget.value)}
						class="max-w-6 rounded-md p-1 hover:ring-1 hover:ring-gray-400 focus:ring-1"
					/>
				</td>
				<td aria-label="Category Name">
					<input
						type="text"
						value={category.value.name}
						onchange={(event) => s.updateCategoryName(category.value.id, event.currentTarget.value)}
						class="rounded-md p-1 hover:ring-1 hover:ring-gray-400 focus:ring-1"
					/>
				</td>
				<td aria-label="Category Color">
					<ButtonLike>
						{#snippet children(className)}
							<select
								class={className}
								value={category.value.color}
								onchange={(event) =>
									s.updateCategoryColor(category.value.id, event.currentTarget.value)}
							>
								<option value="" disabled>Select a Color</option>
								{#each COLORS as color (color.value)}
									<option value={color.value}>{color.label}</option>
								{/each}
							</select>
						{/snippet}
					</ButtonLike>
				</td>
				<td aria-label="Category ID">
					{category.value.id}
				</td>
			</tr>
		{/each}
		{#if isCreatingCategory}
			<tr>
				<td aria-label="New Category Emoji" class="max-w-6">
					<CategoryPill
						category={{ id: '', color: '', emoji: '', name: '', ordinal: 0, ...newCategory }}
						style="color"
					/>
					<input
						type="text"
						bind:value={newCategory.emoji}
						placeholder="🛍️"
						class="max-w-6 p-1 ring-1"
					/>
				</td>
				<td aria-label="New Category Name">
					<input
						type="text"
						bind:value={newCategory.name}
						placeholder="New Category"
						class="p-1 ring-1"
					/>
				</td>
				<td aria-label="New Category Color">
					<ButtonLike>
						{#snippet children(className)}
							<select class={className} bind:value={newCategory.color}>
								<option value="" disabled>Select a Color</option>
								{#each COLORS as color (color.value)}
									<option value={color.value}>{color.label}</option>
								{/each}
							</select>
						{/snippet}
					</ButtonLike>
				</td>
				<td aria-label="New Category ID">
					<input
						type="text"
						bind:value={newCategory.id}
						class="max-w-30 p-1 ring-1"
						placeholder="Optional"
					/>
				</td>
			</tr>
		{/if}
	</tbody>
</table>

<div class="flex gap-2">
	{#if isCreatingCategory}
		<Button
			onclick={onClickSaveCategory}
			disabled={!newCategory.emoji || !newCategory.name || !newCategory.color}>Save Category</Button
		>
		<Button onclick={onClickCancelCreate}>Cancel</Button>
	{:else}
		<Button onclick={onClickNewCategory}>New Category</Button>
	{/if}
</div>
