<script lang="ts">
	import { onMount } from 'svelte';

	let { onclose }: { onclose: () => void } = $props();

	onMount(() => {
		function handleKeydown(event: KeyboardEvent) {
			if (event.key === 'Escape' || event.key.toLowerCase() === 'q' || event.key === '?') {
				event.preventDefault();
				onclose();
			}
		}

		window.addEventListener('keydown', handleKeydown);
		return () => {
			window.removeEventListener('keydown', handleKeydown);
		};
	});
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center p-4">
	<button
		type="button"
		aria-label="Close keyboard shortcuts"
		class="absolute inset-0 bg-black/30"
		onclick={onclose}
	></button>
	<div
		role="dialog"
		aria-label="Keyboard shortcuts"
		aria-modal="true"
		tabindex="-1"
		class="relative z-10 w-full max-w-lg rounded-lg border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-700 dark:bg-gray-900"
	>
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-lg font-semibold">Keyboard Shortcuts</h2>
			<button
				type="button"
				onclick={onclose}
				aria-label="Close keyboard shortcuts"
				class="rounded p-1 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
			>
				<svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
					<path
						fill-rule="evenodd"
						d="M4.22 4.22a.75.75 0 011.06 0L10 8.94l4.72-4.72a.75.75 0 111.06 1.06L11.06 10l4.72 4.72a.75.75 0 11-1.06 1.06L10 11.06l-4.72 4.72a.75.75 0 01-1.06-1.06L8.94 10 4.22 5.28a.75.75 0 010-1.06z"
						clip-rule="evenodd"
					/>
				</svg>
			</button>
		</div>

		<div class="space-y-2 text-sm">
			<div class="flex items-center justify-between">
				<span>Move row down/up</span><kbd>j / k</kbd>
			</div>
			<div class="flex items-center justify-between"><span>Page down/up</span><kbd>d / u</kbd></div>
			<div class="flex items-center justify-between">
				<span>Jump top/bottom</span><kbd>g / G</kbd>
			</div>
			<div class="flex items-center justify-between">
				<span>Edit transaction</span><kbd>e / o</kbd>
			</div>
			<div class="flex items-center justify-between">
				<span>Open category picker</span><kbd>c</kbd>
			</div>
			<div class="flex items-center justify-between">
				<span>Focus first filter control</span><kbd>f</kbd>
			</div>
			<div class="flex items-center justify-between"><span>Focus search</span><kbd>/</kbd></div>
			<div class="flex items-center justify-between">
				<span>Close modal</span><kbd>q / Esc</kbd>
			</div>
			<div class="flex items-center justify-between"><span>Toggle this help</span><kbd>?</kbd></div>
		</div>
	</div>
</div>
