<script lang="ts">
	import { parseStatement } from '$lib/import/sources/schwab';
	import { Statement } from '$lib/import/statement/Statement';
	import { lazy } from '@nfnitloop/better-iterators';
	import { GlobalWorkerOptions } from 'pdfjs-dist';

	GlobalWorkerOptions.workerSrc = '/pdf.worker.js';

	let pageCount = $state(0);

	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		// The property can be null when the event is created using the constructor.
		// It is never null when dispatched by the browser.
		event.dataTransfer!.dropEffect = 'copy';
	}

	async function handleDrop(event: DragEvent) {
		event.preventDefault();
		const file = event.dataTransfer?.files?.[0];
		if (file) {
			const data = await file.arrayBuffer();
			const pdf = await Statement.fromPDF(data);
			console.log(await lazy(parseStatement(pdf)).toArray());
		}
	}
</script>

<div role="region" ondragover={handleDragOver} ondrop={handleDrop} class="h-dvh w-full text-center">
	drop here. page count: {pageCount}
</div>
