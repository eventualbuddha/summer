<script lang="ts">
	import BigButton from '$lib/components/BigButton.svelte';
	import ErrorAlert from '$lib/components/ErrorAlert.svelte';
	import CircleStack from '$lib/components/icons/CircleStack.svelte';
	import type { State } from '$lib/state.svelte';
	import { getContext } from 'svelte';

	let s: State = getContext('state');

	let isSettingUpNewConnection = $state(false);
	let url = $state('');
	let namespace = $state('');
	let database = $state('');
	let isDisplayingError = $state(false);

	async function onConnectDatabase(event: Event) {
		event.preventDefault();
		if (url && namespace && database) {
			await s.connect({
				url,
				namespace,
				database
			});
		}
	}

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

<title>Connections – Summer</title>

<div class="flex h-screen w-screen flex-col items-center justify-center gap-4">
	{#if !isSettingUpNewConnection}
		{#if s.lastDb}
			{@const url = new URL(s.lastDb.url)}
			{@const lastDb = s.lastDb}

			<BigButton title="Last Connection" onclick={() => s.connect(lastDb)}>
				{#snippet icon()}
					<CircleStack />
				{/snippet}
				{#snippet subtitle()}
					{url.hostname} #{lastDb.namespace}/{lastDb.database}
				{/snippet}
			</BigButton>
		{/if}

		<BigButton title="New Connection" onclick={() => (isSettingUpNewConnection = true)}>
			{#snippet icon()}
				<CircleStack />
			{/snippet}
		</BigButton>
	{:else}
		<form onsubmit={onConnectDatabase} class="flex flex-col gap-2 overflow-hidden p-4">
			<div class="flex flex-col">
				<h3 class="text-lg font-bold">
					Connect to <a
						href="https://surrealdb.com"
						target="_blank"
						rel="noopener noreferrer"
						class="text-blue-500 underline hover:text-blue-600"
					>
						SurrealDB
					</a>
				</h3>
				<input
					type="text"
					placeholder="URL"
					bind:value={url}
					required
					class="rounded-t-md border border-gray-300 p-2"
				/>
				<input
					type="text"
					placeholder="Namespace"
					bind:value={namespace}
					required
					class="border-r border-l border-gray-300 p-2"
				/>
				<input
					type="text"
					placeholder="Database"
					bind:value={database}
					required
					class="rounded-b-md border border-gray-300 p-2"
				/>
			</div>
			<button type="submit" class="rounded-md bg-blue-500 px-4 py-2 text-white hover:bg-blue-600">
				Connect
			</button>
			{#if s.lastError && isDisplayingError}
				<ErrorAlert title="Connection Error" body={s.lastError.message} />
			{/if}
		</form>
	{/if}
</div>
