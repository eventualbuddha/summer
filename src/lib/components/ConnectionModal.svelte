<script lang="ts">
	import { Surreal } from 'surrealdb';
	import { getContext } from 'svelte';
	import { use } from '$lib/db';
	import type { State } from '$lib/state.svelte';
	import type { DatabaseConnectionInfo } from '$lib/state.svelte';
	import ConnectionForm from './ConnectionForm.svelte';
	import IconClose from '~icons/mdi/close';

	interface Props {
		onclose: () => void;
	}

	let { onclose }: Props = $props();

	let s: State = getContext('state');

	let isSettingUpNewConnection = $state(false);
	let url = $state('');
	let namespace = $state('');
	let database = $state('');

	async function onConnectDatabase(event: Event) {
		event.preventDefault();
		if (url && namespace && database) {
			// Test the connection first with a throwaway instance
			const testSurreal = new Surreal();
			try {
				await testSurreal.connect(url);
				await use(testSurreal, { namespace, database, init: true });
				await testSurreal.close();

				// Connection works! Now actually connect
				await s.connect({
					url,
					namespace,
					database
				});
				onclose();
			} catch (error) {
				// Store error for display
				s.lastError = error as Error;
				console.error('Connection failed:', error);
			}
		}
	}

	async function onConnectToRecent(connection: DatabaseConnectionInfo) {
		// Test the connection first with a throwaway instance
		const testSurreal = new Surreal();
		try {
			await testSurreal.connect(connection.url);
			await use(testSurreal, {
				namespace: connection.namespace,
				database: connection.database,
				init: true
			});
			await testSurreal.close();

			// Connection works! Now actually connect
			await s.connect(connection);
			onclose();
		} catch (error) {
			// Store error for display
			s.lastError = error as Error;
			console.error('Connection failed:', error);
		}
	}

	function onDisconnect() {
		s.disconnect();
		onclose();
	}

	function getHostname(url: string): string {
		try {
			const urlObj = new URL(url);
			return urlObj.hostname;
		} catch {
			return url;
		}
	}

	function truncate(text: string, maxLength: number): string {
		if (text.length <= maxLength) return text;
		return text.substring(0, maxLength) + '...';
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onclose();
		}
	}

	$effect(() => {
		window.addEventListener('keydown', handleKeydown);
		return () => {
			window.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

<!-- Modal backdrop -->
<div
	class="bg-opacity-50 dark:bg-opacity-70 fixed inset-0 z-50 flex items-center justify-center bg-black dark:bg-black"
	onclick={onclose}
	onkeydown={(e) => e.key === 'Enter' && onclose()}
	role="button"
	tabindex="-1"
>
	<!-- Modal content -->
	<div
		class="relative max-h-[90vh] w-full max-w-md overflow-auto rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800 dark:shadow-gray-900"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
		role="dialog"
		tabindex="-1"
	>
		<!-- Close button -->
		<button
			class="absolute top-4 right-4 rounded-full p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
			onclick={onclose}
			aria-label="Close"
		>
			<IconClose class="h-6 w-6" />
		</button>

		<h2 class="mb-4 text-xl font-bold dark:text-gray-100">Database Connection</h2>

		{#if !isSettingUpNewConnection}
			<div class="flex flex-col gap-4">
				{#if s.recentConnections.length > 0}
					<div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
						<table class="w-full">
							<thead class="bg-gray-50 dark:bg-gray-700">
								<tr>
									<th
										class="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase dark:text-gray-300"
									>
										Database
									</th>
									<th
										class="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase dark:text-gray-300"
									>
										Host
									</th>
									<th
										class="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase dark:text-gray-300"
									>
										Namespace
									</th>
									<th class="px-4 py-2"></th>
								</tr>
							</thead>
							<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
								{#each s.recentConnections as connection (connection.url + connection.namespace + connection.database)}
									<tr class="bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700">
										<td class="px-4 py-3 text-sm text-gray-900 dark:text-gray-200">
											{connection.database}
										</td>
										<td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
											{truncate(getHostname(connection.url), 20)}
										</td>
										<td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
											{connection.namespace}
										</td>
										<td class="px-4 py-3 text-right">
											<button
												class="cursor-pointer rounded bg-blue-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-700"
												onclick={() => onConnectToRecent(connection)}
												disabled={s.isConnecting}
											>
												{s.isConnecting ? 'Connecting...' : 'Connect'}
											</button>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}

				<div class="flex gap-2">
					<button
						class="flex-1 cursor-pointer rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
						onclick={() => (isSettingUpNewConnection = true)}
					>
						New Connection
					</button>
					<button
						class="flex-1 cursor-pointer rounded-md bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-700"
						onclick={onDisconnect}
					>
						Disconnect
					</button>
				</div>
			</div>
		{:else}
			<ConnectionForm
				{s}
				bind:url
				bind:namespace
				bind:database
				onSubmit={onConnectDatabase}
				onCancel={() => (isSettingUpNewConnection = false)}
			/>
		{/if}
	</div>
</div>
