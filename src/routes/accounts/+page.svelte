<script>
	import AccountsScreen from '$lib/screens/AccountsScreen.svelte';
	import { State } from '$lib/state.svelte';

	let s = State.shared;
</script>

<title>Accounts – Summer</title>

<AccountsScreen state={s} />
