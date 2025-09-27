<script lang="ts">
	import type { State } from '$lib/state.svelte';
	import { getContext } from 'svelte';
	import BulkCategoryEditButton from './BulkCategoryEditButton.svelte';

	let s: State = getContext('state');
</script>

<div class="flex flex-row items-center gap-1">
	<span class="font-bold">Actions:</span>
	<BulkCategoryEditButton
		transactions={s.transactions?.list ?? []}
		categories={s.filters?.categories.map(({ value }) => value) ?? []}
	/>
</div>
