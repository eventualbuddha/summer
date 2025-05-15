<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import NavigationButton from '$lib/components/NavigationButton.svelte';
	import type { Account } from '$lib/db';
	import type { State } from '$lib/state.svelte';
	import { getContext } from 'svelte';

	const s: State = getContext('state');

	const NEW_ACCOUNT: Partial<Account> = {
		id: 'new-account',
		name: 'New Account'
	};

	let isCreatingAccount = $state(false);
	let newAccount: Partial<Account> = $state({ ...NEW_ACCOUNT });

	async function onCreateAccount() {
		const { id, name, number, type } = newAccount;
		if (!name || !type) {
			throw new Error('Account fields not set');
		}
		await s.createAccount({ id, name, number, type });
		isCreatingAccount = false;
		newAccount = { ...NEW_ACCOUNT };
	}
</script>

<div class="flex flex-row items-center gap-4">
	<NavigationButton />
	<h1 class="text-2xl font-bold">Accounts</h1>
</div>

<table>
	<thead>
		<tr class="text-left">
			<th class="p-2">Name</th>
			<th class="p-2">Type</th>
			<th class="p-2">Number</th>
			<th class="p-2">ID</th>
		</tr>
	</thead>
	<tbody>
		{#each s.filters.accounts as account (account.value.id)}
			<tr>
				<td class="p-2">
					<input
						type="text"
						value={account.value.name}
						oninput={(event) => s.updateAccountName(account.value.id, event.currentTarget.value)}
						class="p-1 focus:ring-1"
					/>
				</td>
				<td class="p-2">
					<select
						bind:value={
							() => account.value.type, (newType) => s.updateAccountType(account.value.id, newType)
						}
					>
						<option value="credit">Credit</option>
						<option value="checking">Checking</option>
						<option value="savings">Savings</option>
					</select>
				</td>
				<td class="p-2">
					<input
						type="text"
						value={account.value.number}
						oninput={(event) => s.updateAccountNumber(account.value.id, event.currentTarget.value)}
						class="p-1 focus:ring-1"
					/>
				</td>
				<td class="p-2" colspan={2}>
					{account.value.id}
				</td>
			</tr>
		{/each}

		{#if isCreatingAccount}
			<tr class="bg-gray-300 dark:bg-gray-700">
				<td class="p-2">
					<input type="text" bind:value={newAccount.name} class="p-1 ring-1" />
				</td>
				<td class="p-2">
					<select bind:value={newAccount.type}>
						<option value="">Select Type</option>
						<option value="credit">Credit</option>
						<option value="checking">Checking</option>
						<option value="savings">Savings</option>
					</select>
				</td>
				<td class="p-2">
					<input type="text" bind:value={newAccount.number} class="p-1 ring-1" />
				</td>
				<td class="p-2">
					<input type="text" bind:value={newAccount.id} class="p-1 ring-1" />
				</td>
				<td class="p-2">
					<Button onclick={onCreateAccount} disabled={!newAccount.name || !newAccount.type}>
						Create
					</Button>
					<Button onclick={() => (isCreatingAccount = false)}>Cancel</Button>
				</td>
			</tr>
		{:else}
			<Button onclick={() => (isCreatingAccount = true)}>New</Button>
		{/if}
	</tbody>
</table>
