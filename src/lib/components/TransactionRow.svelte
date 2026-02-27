<script lang="ts">
	import type { Category, Transaction } from '$lib/db';
	import type { State } from '$lib/state.svelte';
	import { NONE_CATEGORY } from '$lib/utils/categories';
	import { formatTransactionAmount } from '$lib/utils/formatting';
	import { getContext } from 'svelte';
	import CategoryPill from './CategoryPill.svelte';
	import CategorySelect from './CategorySelect.svelte';
	import TransactionDescription from './TransactionDescription.svelte';
	import TransactionDetailModal from './TransactionDetailModal.svelte';

	let s: State = getContext('state');
	let {
		transaction,
		categories,
		firstTransactionId,
		lastTransactionId
	}: {
		transaction: Transaction;
		categories: Category[];
		firstTransactionId?: string;
		lastTransactionId?: string;
	} = $props();

	let isModalOpen = $state(false);
	let isSelectingCategory = $state(false);
	let rowElement = $state<HTMLDivElement>();
	const currentCategory = $derived(
		categories.find((category) => category.id === transaction.categoryId) ?? NONE_CATEGORY
	);

	function focusAdjacentRow(direction: 1 | -1) {
		if (!rowElement) return;
		const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-transaction]'));
		const currentIndex = rows.indexOf(rowElement);
		if (currentIndex === -1) return;
		const nextRow = rows[currentIndex + direction];
		nextRow?.focus();
	}

	function isScrollable(element: HTMLElement): boolean {
		const style = getComputedStyle(element);
		const overflowY = style.overflowY;
		const canScroll = overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay';
		return canScroll && element.scrollHeight > element.clientHeight + 1;
	}

	function getScrollParent(element: HTMLElement): HTMLElement {
		let parent = element.parentElement;
		while (parent) {
			if (isScrollable(parent)) return parent;
			parent = parent.parentElement;
		}
		return (document.scrollingElement as HTMLElement) ?? document.documentElement;
	}

	function focusPage(direction: 1 | -1) {
		if (!rowElement) return;
		const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-transaction]'));
		const currentIndex = rows.indexOf(rowElement);
		if (currentIndex === -1) return;

		const scrollParent = getScrollParent(rowElement);
		const rowHeight = Math.max(rowElement.getBoundingClientRect().height, 1);
		const pageSize = Math.max(1, Math.floor(scrollParent.clientHeight / rowHeight) - 1);
		const targetIndex = Math.min(rows.length - 1, Math.max(0, currentIndex + direction * pageSize));
		const targetRow = rows[targetIndex];
		targetRow?.focus();
		targetRow?.scrollIntoView({ block: 'nearest' });
	}

	function focusEdge(edge: 'top' | 'bottom') {
		if (!rowElement) return;
		const targetId = edge === 'top' ? firstTransactionId : lastTransactionId;
		const targetTopValue = edge === 'top' ? 0 : Number.MAX_SAFE_INTEGER;

		// Scroll all scrollable ancestors to boundary to support virtualized containers.
		let parent: HTMLElement | null = rowElement;
		while (parent) {
			if (parent.scrollHeight > parent.clientHeight + 1) {
				parent.scrollTop = targetTopValue;
			}
			parent = parent.parentElement;
		}
		const scrollingElement = document.scrollingElement as HTMLElement | null;
		if (scrollingElement) {
			scrollingElement.scrollTop = targetTopValue;
		}

		function focusBoundary(attempt: number) {
			const activeId =
				document.activeElement instanceof HTMLElement
					? document.activeElement.getAttribute('data-transaction-id')
					: null;
			if (targetId && activeId === targetId) {
				return;
			}

			if (targetId) {
				const targetRowById = document.querySelector<HTMLElement>(
					`[data-transaction-id="${CSS.escape(targetId)}"]`
				);
				if (targetRowById) {
					targetRowById.focus();
					targetRowById.scrollIntoView({ block: 'nearest' });
				}
			}

			const refreshedActiveId =
				document.activeElement instanceof HTMLElement
					? document.activeElement.getAttribute('data-transaction-id')
					: null;
			if (targetId && refreshedActiveId === targetId) {
				return;
			}

			const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-transaction]'));
			if (rows.length > 0 && attempt >= 20) {
				const targetRow = edge === 'top' ? rows[0] : rows[rows.length - 1];
				targetRow?.focus();
				targetRow?.scrollIntoView({ block: 'nearest' });
				return;
			}

			if (attempt < 20) {
				requestAnimationFrame(() => focusBoundary(attempt + 1));
			}
		}

		requestAnimationFrame(() => focusBoundary(0));
	}

	function openCategoryPicker() {
		const categoryButton = rowElement?.querySelector<HTMLButtonElement>(
			'[data-transaction-category-trigger]'
		);
		if (!categoryButton) return;
		categoryButton.focus();
		categoryButton.click();
	}

	async function setCategory(category: Category | undefined) {
		await s.setCategory(transaction, category);
		isSelectingCategory = false;
		requestAnimationFrame(() => rowElement?.focus());
	}

	function handleRowClick() {
		if (!isSelectingCategory) {
			isModalOpen = true;
		}
	}

	function handleModalClose() {
		isModalOpen = false;
		rowElement?.focus();
	}
</script>

<div
	bind:this={rowElement}
	data-transaction
	data-transaction-id={transaction.id}
	data-is-first-transaction={transaction.id === firstTransactionId ? 'true' : undefined}
	data-is-last-transaction={transaction.id === lastTransactionId ? 'true' : undefined}
	class="-mx-1 flex grow-0 cursor-pointer flex-row items-center gap-2 rounded-md px-1 transition-colors focus-within:bg-sky-50/70 hover:bg-gray-100 focus:outline-none focus-visible:bg-sky-50 dark:focus-within:bg-sky-900/20 dark:hover:bg-gray-800 dark:focus-visible:bg-sky-900/25"
	onclick={handleRowClick}
	onkeydown={(e) => {
		if (e.target !== e.currentTarget) return;
		if (e.ctrlKey || e.metaKey || e.altKey) return;
		const key = e.key.toLowerCase();
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			handleRowClick();
			return;
		}
		if (key === 'j') {
			e.preventDefault();
			focusAdjacentRow(1);
			return;
		}
		if (key === 'k') {
			e.preventDefault();
			focusAdjacentRow(-1);
			return;
		}
		if (key === 'e' || key === 'o') {
			e.preventDefault();
			handleRowClick();
			return;
		}
		if (key === 'c') {
			e.preventDefault();
			e.stopPropagation();
			openCategoryPicker();
			return;
		}
		if (key === 'd') {
			e.preventDefault();
			focusPage(1);
			return;
		}
		if (key === 'u') {
			e.preventDefault();
			focusPage(-1);
			return;
		}
		if (key === 'g' && !e.shiftKey) {
			e.preventDefault();
			focusEdge('top');
			return;
		}
		if (e.key === 'G') {
			e.preventDefault();
			focusEdge('bottom');
		}
	}}
	role="button"
	tabindex="0"
>
	<div
		class="text-xs"
		class:text-blue-600={transaction.effectiveDate}
		class:text-gray-600={!transaction.effectiveDate}
	>
		<div class="w-12 text-center" data-testid="transaction-date">
			{#if transaction.effectiveDate}
				{transaction.effectiveDate.toLocaleDateString(undefined, { month: 'short' })}<br />
				{transaction.effectiveDate.toLocaleDateString(undefined, { year: 'numeric' })}
			{:else}
				{transaction.date.toLocaleDateString(undefined, { month: 'short', day: '2-digit' })}<br />
				{transaction.date.toLocaleDateString(undefined, { year: 'numeric' })}
			{/if}
		</div>
	</div>
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div onclick={(e) => e.stopPropagation()}>
		<CategorySelect
			bind:isOpen={isSelectingCategory}
			bind:value={
				() => categories.find((category) => category.id === transaction.categoryId),
				(newCategory) => setCategory(newCategory)
			}
			{categories}
		>
			{#snippet trigger(isOpen, setIsOpen)}
				<button
					data-transaction-category-trigger
					onclick={() => setIsOpen(!isOpen)}
					aria-label={currentCategory.name}
				>
					<CategoryPill category={currentCategory} style="short" />
				</button>
			{/snippet}
		</CategorySelect>
	</div>
	<div class="flex-1 overflow-hidden text-lg overflow-ellipsis whitespace-nowrap">
		<TransactionDescription {transaction} />
	</div>
	<div>{formatTransactionAmount(transaction.amount)}</div>
</div>

{#if isModalOpen}
	<TransactionDetailModal {transaction} {categories} onclose={handleModalClose} />
{/if}
