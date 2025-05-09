<script>
	import ConnectionScreen from '$lib/screens/ConnectionScreen.svelte';
	import AccountsScreen from '$lib/screens/AccountsScreen.svelte';
	import { State } from '$lib/state.svelte';

	let s = new State();
</script>

<title>Accounts – Summer</title>

{#if !s.isConnected}
	<ConnectionScreen bind:state={s} />
{:else}
	<AccountsScreen state={s} />
{/if}
