<script lang="ts">
	import ConnectionScreen from '$lib/screens/ConnectionScreen.svelte';
	import TransactionsScreen from '$lib/screens/TransactionsScreen.svelte';
	import { State } from '$lib/state.svelte';

	let s = new State();
</script>

{#if !s.isConnected}
	<ConnectionScreen state={s} />
{:else}
	<TransactionsScreen state={s} />
{/if}
