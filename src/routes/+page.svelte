<script lang="ts">
	import ConnectionScreen from '$lib/screens/ConnectionScreen.svelte';
	import TransactionsScreen from '$lib/screens/TransactionsScreen.svelte';
	import { State } from '$lib/state.svelte';

	let s = State.shared;
</script>

{#if !s.isConnected}
	<ConnectionScreen bind:state={s} />
{:else}
	<TransactionsScreen bind:state={s} />
{/if}
