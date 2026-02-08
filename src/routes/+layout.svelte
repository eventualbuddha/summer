<script lang="ts">
	import ErrorAlert from '$lib/components/ErrorAlert.svelte';
	import { State } from '$lib/state.svelte';
	import { setContext, type Snippet } from 'svelte';
	import '../app.css';

	let s = new State();
	setContext('state', s);

	let { children }: { children: Snippet } = $props();

	let isDisplayingError = $state(false);

	$effect(() => {
		if (s.lastError) {
			isDisplayingError = true;
			const timeout = setTimeout(() => {
				isDisplayingError = false;
			}, 5000);

			return () => {
				isDisplayingError = false;
				clearTimeout(timeout);
			};
		}
	});
</script>

{#if s.lastError && isDisplayingError}
	<div class="fixed top-4 right-4 z-[100] max-w-md">
		<ErrorAlert title="Error" body={s.lastError.message} />
	</div>
{/if}

{#if s.isConnecting}
	<div class="flex h-screen w-screen items-center justify-center">
		<div class="text-lg text-gray-600 dark:text-gray-300">Connecting to database...</div>
	</div>
{:else if s.isConnected}
	<div class="relative flex h-screen w-screen flex-col gap-4 overflow-hidden p-4">
		{@render children()}
	</div>
{:else}
	<div class="flex h-screen w-screen items-center justify-center">
		<div class="text-center text-gray-600 dark:text-gray-300">
			<p class="text-lg">Unable to connect to database</p>
			<p class="mt-2 text-sm">Please check that the backend is running properly</p>
		</div>
	</div>
{/if}
