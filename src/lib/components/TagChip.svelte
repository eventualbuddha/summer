<script lang="ts">
	let {
		name,
		size = 'sm',
		onremove
	}: {
		name: string;
		size?: 'xs' | 'sm';
		onremove?: () => void;
	} = $props();

	let textSize = $derived(size === 'xs' ? 'text-xs' : 'text-sm');
</script>

<span
	class="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 {textSize} text-blue-800 dark:bg-blue-800 dark:text-blue-200"
>
	{name}
	{#if onremove}
		<button
			type="button"
			class="ml-0.5 cursor-pointer text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100"
			onclick={(e) => {
				e.stopPropagation();
				onremove();
			}}
			aria-label="Remove tag {name}"
		>
			&times;
		</button>
	{/if}
</span>
