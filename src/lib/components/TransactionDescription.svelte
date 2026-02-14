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
		<span
			title={bankDescription.text}
			class="text-sm font-semibold text-gray-900 dark:text-gray-200"
		>
			{ownDescription}
		</span>
	{/if}

	{#each transaction.tagged as tagged (tagged.tag.id)}
		<span
			class="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-200"
		>
			#{tagged.tag.name}{#if tagged.year}-{tagged.year}{/if}
		</span>
	{/each}

	<span
		title={bankDescription.text}
		class="overflow-hidden text-sm overflow-ellipsis text-gray-400 font-mono dark:text-gray-400"
	>
		{bankDescription.text}
	</span>
</span>
