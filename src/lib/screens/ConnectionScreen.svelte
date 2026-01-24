<script lang="ts">
	import ConnectionForm from '$lib/components/ConnectionForm.svelte';
	import { use } from '$lib/db';
	import type { State, DatabaseConnectionInfo } from '$lib/state.svelte';
	import { Surreal } from 'surrealdb';
	import { getContext, onMount } from 'svelte';

	let s: State = getContext('state');

	let isSettingUpNewConnection = $state(false);
	let hasBackend = $state(false);
	let backendInfo = $state<{
		port?: string;
		defaultNamespace?: string;
		defaultDatabase?: string;
	}>({});
	let url = $state('');
	let namespace = $state('');
	let database = $state('');
	let useBackend = $state(false);

	onMount(async () => {
		// Check if backend is available
		try {
			const response = await fetch('/api/backend-info');
			if (response.ok) {
				const info = await response.json();
				hasBackend = info.hasBackend;
				if (info.hasBackend) {
					backendInfo = {
						url: info.url,
						defaultNamespace: info.defaultNamespace,
						defaultDatabase: info.defaultDatabase
					};
					// Auto-connect to backend only on first visit (no recent connections and no stored preference)
					const hasExplicitlyDisconnected =
						localStorage.getItem('hasExplicitlyDisconnected') === 'true';
					if (s.recentConnections.length === 0 && !hasExplicitlyDisconnected) {
						useBackend = true;
						url = info.url;
						namespace = info.defaultNamespace;
						database = info.defaultDatabase;
						// Trigger the connection
						await onConnectDatabase(new Event('submit'));
					}
				}
			}
		} catch (error) {
			console.error('Failed to check backend availability:', error);
		}
	});

	async function onConnectDatabase(event: Event) {
		event.preventDefault();
		console.log('onConnectDatabase called', { url, namespace, database });
		if (url && namespace && database) {
			// Test the connection first with a throwaway instance
			const testSurreal = new Surreal();
			try {
				console.log('Testing connection to:', url);
				await testSurreal.connect(url);
				console.log('Connected, using namespace/database:', namespace, database);
				await use(testSurreal, { namespace, database, init: true });
				await testSurreal.close();
				console.log('Test connection successful, now connecting for real');

				// Connection works! Now actually connect
				await s.connect({
					url,
					namespace,
					database
				});
				console.log('Real connection established');
			} catch (error) {
				// Store error for display
				console.error('Connection failed:', error);
				s.lastError = error as Error;
			}
		} else {
			console.error('Missing connection details:', { url, namespace, database });
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
		} catch (error) {
			// Store error for display
			s.lastError = error as Error;
			console.error('Connection failed:', error);
		}
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
</script>

<title>Connections – Summer</title>

<div
	class="flex h-screen w-screen flex-col items-center justify-center bg-gray-50 p-8 dark:bg-gray-900"
>
	<div class="w-full max-w-2xl">
		{#if s.lastError}
			<div class="mb-4 rounded-lg bg-red-50 p-4 text-red-800 dark:bg-red-900 dark:text-red-200">
				<p class="font-semibold">Connection Error</p>
				<p class="text-sm">{s.lastError.message}</p>
			</div>
		{/if}

		{#if !isSettingUpNewConnection}
			<div class="rounded-lg bg-white p-8 shadow-lg dark:bg-gray-800">
				<h1 class="mb-6 text-center text-3xl font-bold text-gray-900 dark:text-gray-100">
					Connect to Database
				</h1>

				{#if s.recentConnections.length > 0}
					<div class="mb-6">
						<h2
							class="mb-3 text-sm font-semibold tracking-wide text-gray-600 uppercase dark:text-gray-400"
						>
							Recent Connections
						</h2>
						<div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
							<table class="w-full">
								<thead class="bg-gray-50 dark:bg-gray-700">
									<tr>
										<th
											class="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase dark:text-gray-300"
										>
											Database
										</th>
										<th
											class="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase dark:text-gray-300"
										>
											Host
										</th>
										<th
											class="px-4 py-3 text-left text-xs font-medium text-gray-600 uppercase dark:text-gray-300"
										>
											Namespace
										</th>
										<th class="px-4 py-3"></th>
									</tr>
								</thead>
								<tbody class="divide-y divide-gray-200 dark:divide-gray-700">
									{#each s.recentConnections as connection (connection.url + connection.namespace + connection.database)}
										<tr class="bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700">
											<td class="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-200">
												{connection.database}
											</td>
											<td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
												{truncate(getHostname(connection.url), 25)}
											</td>
											<td class="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
												{connection.namespace}
											</td>
											<td class="px-4 py-3 text-right">
												<button
													class="cursor-pointer rounded-md bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-700"
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
					</div>
				{/if}

				{#if hasBackend}
					<button
						class="mb-3 w-full cursor-pointer rounded-md bg-green-500 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-green-600 disabled:opacity-50 dark:bg-green-600 dark:hover:bg-green-700"
						onclick={async () => {
							useBackend = true;
							url = backendInfo.url;
							namespace = backendInfo.defaultNamespace || 'summer';
							database = backendInfo.defaultDatabase || 'summer';
							await onConnectDatabase(new Event('submit'));
						}}
						disabled={s.isConnecting}
					>
						{s.isConnecting ? 'Connecting...' : 'Use Built-in Database'}
					</button>
				{/if}

				<button
					class="w-full cursor-pointer rounded-md bg-gray-200 px-4 py-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
					onclick={() => {
						isSettingUpNewConnection = true;
						useBackend = false;
					}}
				>
					{hasBackend ? 'Connect to External Database' : 'New Connection'}
				</button>
			</div>
		{:else}
			<div class="rounded-lg bg-white p-8 shadow-lg dark:bg-gray-800">
				<h1 class="mb-6 text-center text-3xl font-bold text-gray-900 dark:text-gray-100">
					{hasBackend ? 'External Connection' : 'New Connection'}
				</h1>

				{#if hasBackend && !useBackend}
					<p class="mb-4 text-center text-sm text-gray-600 dark:text-gray-400">
						Connect to an external SurrealDB instance instead of the built-in database.
					</p>
				{/if}

				<ConnectionForm
					{s}
					bind:url
					bind:namespace
					bind:database
					onSubmit={onConnectDatabase}
					onCancel={() => {
						isSettingUpNewConnection = false;
						useBackend = false;
					}}
				/>
			</div>
		{/if}
	</div>
</div>
