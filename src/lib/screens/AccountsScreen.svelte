<script lang="ts">
	import NavigationButton from '$lib/components/NavigationButton.svelte';
	import type { State } from '$lib/state.svelte';
	import { getContext } from 'svelte';

	const s: State = getContext('state');
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
				<td role="cell" aria-label="Account Name" class="p-2">
					<input
						type="text"
						value={account.value.name}
						onchange={(event) => s.updateAccountName(account.value.id, event.currentTarget.value)}
						class="p-1 focus:ring-1"
					/>
				</td>
				<td role="cell" aria-label="Account Type" class="p-2">
					<select
						value={account.value.type}
						onchange={(event) => s.updateAccountType(account.value.id, event.currentTarget.value)}
					>
						<option value="credit">Credit</option>
						<option value="checking">Checking</option>
						<option value="savings">Savings</option>
					</select>
				</td>
				<td role="cell" aria-label="Account Number" class="p-2">
					<input
						type="text"
						value={account.value.number}
						onchange={(event) => s.updateAccountNumber(account.value.id, event.currentTarget.value)}
						class="p-1 focus:ring-1"
					/>
				</td>
				<td role="cell" aria-label="Account ID" class="p-2">
					{account.value.id}
				</td>
			</tr>
		{/each}
	</tbody>
</table>
