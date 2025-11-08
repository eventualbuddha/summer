<script lang="ts">
	import ConnectionScreen from '$lib/screens/ConnectionScreen.svelte';
	import ConnectionWidget from '$lib/components/ConnectionWidget.svelte';
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
		<ErrorAlert title="Connection Error" body={s.lastError.message} />
	</div>
{/if}

{#if !s.isConnected && !s.isConnecting}
	<ConnectionScreen />
{:else if s.isConnecting}
	<div class="flex h-screen w-screen items-center justify-center">
		<div class="text-lg text-gray-600 dark:text-gray-300">Connecting...</div>
	</div>
{:else}
	<div class="relative flex h-screen w-screen flex-col gap-4 overflow-hidden p-4">
		<div class="absolute top-4 right-4 z-10">
			<ConnectionWidget />
		</div>
		{@render children()}
	</div>
{/if}
