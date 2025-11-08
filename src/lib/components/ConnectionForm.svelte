<script lang="ts">
	import type { State } from '$lib/state.svelte';

	interface Props {
		s: State;
		url: string;
		namespace: string;
		database: string;
		onSubmit: (event: Event) => void;
		onCancel?: () => void;
	}

	let {
		s,
		url = $bindable(),
		namespace = $bindable(),
		database = $bindable(),
		onSubmit,
		onCancel
	}: Props = $props();
</script>

<form onsubmit={onSubmit} class="flex flex-col gap-4">
	<p class="text-center text-sm text-gray-600 dark:text-gray-400">
		Connect to your <a
			href="https://surrealdb.com"
			target="_blank"
			rel="noopener noreferrer"
			class="text-blue-500 underline hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
		>
			SurrealDB
		</a> instance
	</p>

	<div class="space-y-3">
		<div>
			<label for="url" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
				Connection URL
			</label>
			<input
				id="url"
				type="text"
				placeholder="ws://localhost:8000"
				bind:value={url}
				required
				class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
			/>
		</div>

		<div>
			<label
				for="namespace"
				class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
			>
				Namespace
			</label>
			<input
				id="namespace"
				type="text"
				placeholder="my_namespace"
				bind:value={namespace}
				required
				class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
			/>
		</div>

		<div>
			<label for="database" class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
				Database
			</label>
			<input
				id="database"
				type="text"
				placeholder="my_database"
				bind:value={database}
				required
				class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100 dark:placeholder-gray-400"
			/>
		</div>
	</div>

	<div class="flex gap-3">
		{#if onCancel}
			<button
				type="button"
				class="flex-1 cursor-pointer rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
				onclick={onCancel}
			>
				Back
			</button>
		{/if}
		<button
			type="submit"
			class="flex-1 cursor-pointer rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-700"
			disabled={s.isConnecting}
		>
			{s.isConnecting ? 'Connecting...' : 'Connect'}
		</button>
	</div>
</form>
