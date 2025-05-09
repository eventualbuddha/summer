<script lang="ts">
	import TransactionsScreen from '$lib/screens/TransactionsScreen.svelte';
	import { State } from '$lib/state.svelte';

	let s = State.shared;
</script>

<TransactionsScreen bind:state={s} />
