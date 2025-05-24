<script lang="ts">
	import type { Transaction } from '$lib/db';
	import { tidyBankDescription } from '$lib/utils/tidyBankDescription';
	import TransactionIcon from './TransactionIcon.svelte';

	let { transaction, onclick }: { transaction: Transaction; onclick?: () => void } = $props();

	let bankDescription = $derived(tidyBankDescription(transaction.statementDescription));
	let ownDescription = $derived(transaction.description);

	// This is here to ensure the tags have separation as far as screen readers
	// are concerned, which is important for accessibility and testing.
	const space = ' ';
</script>

<button class="flex flex-row items-center gap-2" {onclick}>
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
		<span
			title={bankDescription.text}
			class="text-sm font-semibold text-gray-900 dark:text-gray-200"
		>
			{ownDescription}
		</span>
	{/if}

	<span
		title={bankDescription.text}
		class="flex flex-row gap-2 overflow-hidden font-mono text-sm overflow-ellipsis text-gray-400 dark:text-gray-400"
	>
		{#each transaction.tagged as tagged (tagged.tag.id)}
			<span class="text-gray-700 dark:text-gray-300">
				{space}#{tagged.tag.name}{#if tagged.year}-{tagged.year}{/if}
			</span>
		{/each}
		{bankDescription.text}
	</span>
</button>
