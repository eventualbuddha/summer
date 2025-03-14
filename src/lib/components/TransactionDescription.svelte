<script lang="ts">
	import type { Transaction } from '$lib/db';
	import { tidyBankDescription } from '$lib/utils/tidyBankDescription';
	import TransactionIcon from './TransactionIcon.svelte';

	let { transaction }: { transaction: Transaction } = $props();

	let bankDescription = $derived(tidyBankDescription(transaction.statementDescription));
	let ownDescription = $derived(transaction.description);
</script>

<span class="flex flex-row items-center gap-2">
	{#if bankDescription.amazon}
		<TransactionIcon path="/amazon.svg" alt="Amazon" />
	{/if}

	{#if bankDescription.doordash}
		<TransactionIcon path="/doordash.svg" alt="DoorDash" />
	{/if}

	{#if bankDescription.cashApp}
		<TransactionIcon path="/cash-app.svg" alt="Cash App" />
	{/if}

	{#if bankDescription.github}
		<TransactionIcon path="/github.svg" alt="GitHub" />
	{/if}

	{#if bankDescription.venmo}
		<TransactionIcon path="/venmo.svg" alt="Venmo" />
	{/if}

	{#if ownDescription}
		<span title={bankDescription.text} class="font-semibold text-gray-900 dark:text-gray-200">
			{ownDescription}
		</span>
	{/if}

	<span
		title={bankDescription.text}
		class="overflow-hidden font-mono text-sm overflow-ellipsis text-gray-500 dark:text-gray-300"
	>
		{bankDescription.text}
	</span>
</span>
