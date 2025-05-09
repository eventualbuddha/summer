<script lang="ts">
	import type { Snippet } from 'svelte';
	import '../app.css';

	let { children }: { children: Snippet } = $props();
</script>

<div class="flex h-screen w-screen flex-col gap-4 overflow-hidden p-4">
	{@render children()}
</div>
