<script lang="ts">
	import { getContext } from 'svelte';
	import type { State } from '$lib/state.svelte';
	import IconLightningBolt from '~icons/mdi/lightning-bolt';
	import ConnectionModal from './ConnectionModal.svelte';

	let s: State = getContext('state');
	let showModal = $state(false);
</script>

{#if s.isConnected && s.lastDb}
	<button
		class="flex cursor-pointer items-center gap-1.5 rounded px-2 py-1 text-xs text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-300"
		onclick={() => (showModal = true)}
		title={`${s.lastDb.url} - ${s.lastDb.namespace}/${s.lastDb.database}`}
	>
		<IconLightningBolt class="h-3.5 w-3.5 text-yellow-500" />
		<span>{s.lastDb.database}</span>
	</button>
{/if}

{#if showModal}
	<ConnectionModal onclose={() => (showModal = false)} />
{/if}
