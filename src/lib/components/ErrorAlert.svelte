<script lang="ts">
	import { cubicOut } from 'svelte/easing';
	import { fly } from 'svelte/transition';

	let { title, body }: { title: string; body: string } = $props();
</script>

<div
	class="border-l-4 border-orange-500 bg-orange-100 p-4 text-orange-700 dark:border-orange-600 dark:bg-orange-900 dark:text-orange-200"
	transition:fly={{ x: '100%', duration: 300, easing: cubicOut }}
	role="alert"
>
	<p class="font-bold">{title}</p>
	<p>{body}</p>
</div>
