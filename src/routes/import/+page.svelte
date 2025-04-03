<script lang="ts">
	import TransactionRow from '$lib/components/TransactionRow.svelte';
	import type { Category } from '$lib/db';
	import { ImportedTransaction } from '$lib/import/ImportedTransaction';
	import { parseStatement } from '$lib/import/sources/schwab';
	import { Statement } from '$lib/import/statement/Statement';
	import { State } from '$lib/state.svelte';
	import { GlobalWorkerOptions } from 'pdfjs-dist';

	GlobalWorkerOptions.workerSrc = '/pdf.worker.js';

	let s = $state(new State());
	let transactions: ImportedTransaction[] = $state([]);

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		// The property can be null when the event is created using the constructor.
		// It is never null when dispatched by the browser.
		event.dataTransfer!.dropEffect = 'copy';
	}

	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		transactions = [];
		const file = event.dataTransfer?.files?.[0];
		if (file) {
			const data = await file.arrayBuffer();
			const pdf = await Statement.fromPDF(data);
			for await (const result of parseStatement(pdf)) {
				if (result.isErr) {
					console.error(result.error);
				} else {
					if (result.value instanceof ImportedTransaction) {
						transactions.push(result.value);
					}
				}
			}
		}
	}

	let categories: Category[] = [
		{
			id: 'placeholder',
			name: 'Placeholder',
			color: 'yellow-200',
			emoji: '🛍️',
			ordinal: 1
		}
	];
</script>

<div role="region" ondragover={handleDragOver} ondrop={handleDrop} class="h-dvh w-full text-center">
	drop here

	{#each transactions as transaction, index (transaction)}
		<TransactionRow
			transaction={{
				id: `transaction-${index}`,
				date: transaction.date.toJSDate(),
				amount: transaction.amount,
				category: categories[0]!,
				statementDescription: transaction.statementDescription,
				statementId: 'importing'
			}}
			state={s}
			{categories}
		/>
	{/each}
</div>
