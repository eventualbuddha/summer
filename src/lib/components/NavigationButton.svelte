<script>
	import { page } from '$app/state';
	import Dropdown from './Dropdown.svelte';
	import MenuButton from './MenuButton.svelte';
</script>

<Dropdown content-class="flex items-center">
	{#snippet trigger(isOpen)}
		<MenuButton {isOpen} />
	{/snippet}
	{#snippet root(contents)}
		<div class="relative">
			{@render contents()}
		</div>
	{/snippet}
	{#snippet portal()}
		<div
			class="absolute top-0 left-0 z-10 mt-4 flex min-w-45 origin-top-left flex-col rounded-md bg-white px-2 pt-2 pb-2 shadow-lg ring-1 ring-black/5 focus:outline-hidden dark:bg-gray-800 dark:shadow-gray-600 dark:ring-gray-600"
			role="menu"
			aria-orientation="vertical"
			aria-labelledby="menu-button"
			tabindex="-1"
		>
			<a class="p-1 hover:font-bold {page.url.pathname === '/' && 'font-bold'}" href="/">
				Transactions
			</a>
			<a
				class="p-1 hover:font-bold {page.url.pathname === '/accounts' && 'font-bold'}"
				href="/accounts"
			>
				Accounts
			</a>
		</div>
	{/snippet}
</Dropdown>
