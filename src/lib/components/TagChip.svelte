<script lang="ts">
	let {
		name,
		size = 'sm',
		variant = 'tag',
		focused = false,
		onremove,
		onclick
	}: {
		name: string;
		size?: 'xs' | 'sm';
		variant?: 'tag' | 'amount' | 'desc' | 'bank';
		focused?: boolean;
		onremove?: () => void;
		onclick?: () => void;
	} = $props();

	let textSize = $derived(size === 'xs' ? 'text-xs' : 'text-sm');

	const colorMap: Record<string, string> = {
		tag: 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-200',
		amount: 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200',
		desc: 'bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-200',
		bank: 'bg-amber-100 text-amber-800 dark:bg-amber-800 dark:text-amber-200'
	};

	const buttonColorMap: Record<string, string> = {
		tag: 'text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100',
		amount: 'text-green-600 hover:text-green-800 dark:text-green-300 dark:hover:text-green-100',
		desc: 'text-purple-600 hover:text-purple-800 dark:text-purple-300 dark:hover:text-purple-100',
		bank: 'text-amber-600 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-100'
	};
</script>

<span
	class="inline-flex items-center rounded-full {colorMap[variant]} px-2 py-0.5 {textSize} {focused
		? 'ring-2 ring-offset-1'
		: ''}"
	{onclick}
>
	{name}
	{#if onremove}
		<button
			type="button"
			class="ml-0.5 cursor-pointer {buttonColorMap[variant]}"
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
