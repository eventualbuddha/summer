<script lang="ts">
	import ConnectionScreen from '$lib/screens/ConnectionScreen.svelte';
	import { State } from '$lib/state.svelte';
	import { setContext, type Snippet } from 'svelte';
	import '../app.css';

	let s = new State();
	setContext('state', s);

	let { children }: { children: Snippet } = $props();
</script>

{#if !s.isConnected}
	<ConnectionScreen />
{:else}
	<div class="flex h-screen w-screen flex-col gap-4 overflow-hidden p-4">
		{@render children()}
	</div>
{/if}
