<script lang="ts">
	import ErrorAlert from '$lib/components/ErrorAlert.svelte';
	import { parseStatement } from '$lib/import';
	import { ImportedTransaction } from '$lib/import/ImportedTransaction';
	import { Statement } from '$lib/import/statement/Statement';
	import { StatementMetadata } from '$lib/import/StatementMetadata';
	import type { State } from '$lib/state.svelte';
	import { getContext } from 'svelte';
	import Button from '../components/Button.svelte';
	import { PageSchema } from '$lib/import/statement/page';
	import { z } from 'zod';

	let s: State = getContext('state');

	let fileInput = $state<HTMLInputElement>();
	let error = $state<string>();

	function onClickImport() {
		fileInput?.click();
	}

	async function onInputFile() {
		const file = fileInput?.files?.[0];
		if (!file) {
			error = undefined;
			return;
		}

		let extMatch = file.name.match(/\.(\w+)$/);
		let ext = extMatch?.[1]?.toUpperCase();

		let pdfData: Uint8Array;
		let statement: Statement;
		switch (ext) {
			case 'PDF': {
				pdfData = new Uint8Array(await file.arrayBuffer());
				statement = await Statement.fromPDF(pdfData);
				error = undefined;
				break;
			}
			case 'JSON': {
				const jsonData = await file.text();
				pdfData = new TextEncoder().encode(jsonData);
				const pages = z.array(PageSchema).parse(JSON.parse(jsonData));
				statement = new Statement(pages);
				error = undefined;
				break;
			}
			default: {
				error = `Unsupported file type: ${ext ?? file.name}`;
				return;
			}
		}

		const parseResult = parseStatement(statement);

		const successfulImport = parseResult.find(({ results }) =>
			results.every((result) => result.isOk)
		);

		if (!successfulImport) {
			let errorCount = 0;
			console.error('Import Failed! Full parse result:', parseResult);
			for (let { source, results } of parseResult) {
				for (let result of results) {
					if (result.isErr) {
						errorCount += 1;
						console.error(`[${source}]`, result.error);
					}
				}
			}

			error = `Unable to import statement (${errorCount} error(s), see log)`;
			return;
		}

		let metadata = successfulImport.results
			.map((r) => r.unwrap())
			.find((v) => v instanceof StatementMetadata);
		let transactions = successfulImport.results
			.map((r) => r.unwrap())
			.filter((v) => v instanceof ImportedTransaction);

		if (!metadata) {
			error = 'No statement metadata found in import!';
			return;
		}

		try {
			const result = await s.importStatement(
				file.name,
				pdfData,
				successfulImport.source,
				metadata,
				transactions
			);

			if (result.isOk) {
				error = undefined;
			} else {
				error = result.error.message;
			}
		} catch (e) {
			error = (e as Error).message;
		}
	}
</script>

<input type="file" class="hidden" bind:this={fileInput} oninput={onInputFile} />
<Button onclick={onClickImport} class="text-xs">Import</Button>

{#if error}
	<ErrorAlert title="Import Error" body={error} />
{/if}
