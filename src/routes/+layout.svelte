<script lang="ts">
	import type { Snippet } from 'svelte';
	import '../app.css';
	import { State } from '$lib/state.svelte';
	import ConnectionScreen from '$lib/screens/ConnectionScreen.svelte';

	let s = State.shared;
	let { children }: { children: Snippet } = $props();
</script>

{#if !s.isConnected}
	<ConnectionScreen state={s} />
{:else}
	<div class="flex h-screen w-screen flex-col gap-4 overflow-hidden p-4">
		{@render children()}
	</div>
{/if}
