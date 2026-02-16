<script lang="ts">
	import type { Category, Transaction } from '$lib/db';
	import type { State } from '$lib/state.svelte';
	import { getTransactionDetail, type TransactionDetail } from '$lib/api';
	import { formatTransactionAmount } from '$lib/utils/formatting';
	import { tidyBankDescription } from '$lib/utils/tidyBankDescription';
	import { NONE_CATEGORY } from '$lib/utils/categories';
	import { getContext, onMount } from 'svelte';
	import CategorySelect from './CategorySelect.svelte';
	import CategoryPill from './CategoryPill.svelte';
	import TagInput from './TagInput.svelte';
	import { resolve } from '$app/paths';

	let s: State = getContext('state');

	let {
		transaction,
		categories,
		onclose
	}: {
		transaction: Transaction;
		categories: Category[];
		onclose: () => void;
	} = $props();

	let detail = $state<TransactionDetail>();
	let descriptionValue = $state(transaction.description ?? '');
	let isSelectingCategory = $state(false);
	let descriptionInput = $state<HTMLInputElement>();
	let closeButton = $state<HTMLButtonElement>();
	let tagInput = $state<{ focus: () => void }>();
	let modalContent = $state<HTMLDivElement>();
	let portalTarget = $state<HTMLDivElement>();

	let bankDescription = $derived(tidyBankDescription(transaction.statementDescription));

	let currentCategory = $derived(categories.find((c) => c.id === transaction.categoryId));

	let statementLabel = $derived.by(() => {
		if (!detail?.statementDate) return undefined;
		const date = new Date(detail.statementDate);
		return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
	});

	onMount(() => {
		// Teleport modal to document.body to escape VList's transform context
		const container = document.createElement('div');
		document.body.appendChild(container);
		container.appendChild(portalTarget!);

		// Focus after portal move
		setTimeout(() => descriptionInput?.focus(), 0);

		getTransactionDetail(transaction.id).then((d) => {
			detail = d;
		});

		function handleKeydown(e: KeyboardEvent) {
			if (e.key === 'Escape') {
				e.preventDefault();
				onclose();
			}
		}

		window.addEventListener('keydown', handleKeydown);
		return () => {
			window.removeEventListener('keydown', handleKeydown);
			container.remove();
		};
	});

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) onclose();
	}

	function handleTabKeydown(e: KeyboardEvent) {
		if (e.key === 'Tab') {
			const focusable = modalContent?.querySelectorAll<HTMLElement>(
				'input, button, select, [tabindex]:not([tabindex="-1"])'
			);
			if (!focusable || focusable.length === 0) return;

			const first = focusable[0]!;
			const last = focusable[focusable.length - 1]!;

			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		}
	}

	async function handleDescriptionBlur() {
		const trimmed = descriptionValue.trim();
		if (trimmed !== (transaction.description ?? '')) {
			const result = await s.updateDescription(transaction, trimmed);
			if (result.isErr) {
				s.lastError = result.error;
				descriptionValue = transaction.description ?? '';
			}
		}
	}

	function handleDescriptionKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			(e.target as HTMLInputElement).blur();
		}
	}

	async function handleTagsChange(newTagged: typeof transaction.tagged) {
		const newTags = newTagged.map((t) => ({
			name: t.tag.name,
			year: t.year
		}));
		const originalTagged = transaction.tagged;
		const result = await s.updateTags(transaction, newTags, originalTagged);
		if (result.isErr) {
			s.lastError = result.error;
		}
	}

	async function setCategory(category: Category | undefined) {
		await s.setCategory(transaction, category);
		isSelectingCategory = false;
	}
</script>

<div bind:this={portalTarget}>
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
		onclick={handleBackdropClick}
		onkeydown={handleTabKeydown}
		role="presentation"
	>
		<div
			bind:this={modalContent}
			class="mx-4 w-full max-w-lg rounded-lg bg-white p-6 shadow-xl dark:bg-gray-800"
			role="dialog"
			aria-modal="true"
			aria-label="Transaction details"
		>
			<!-- Header with close button -->
			<div class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold">Transaction Details</h2>
				<button
					bind:this={closeButton}
					type="button"
					onclick={onclose}
					class="cursor-pointer text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
					aria-label="Close"
				>
					&times;
				</button>
			</div>

			<!-- Read-only section -->
			<div class="mb-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
				<div class="flex justify-between">
					<span class="font-medium">Account</span>
					{#if detail}
						<span data-testid="detail-account">{detail.accountName}</span>
					{:else}
						<span class="animate-pulse rounded bg-gray-200 dark:bg-gray-700"
							>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span
						>
					{/if}
				</div>
				<div class="flex justify-between">
					<span class="font-medium">Statement</span>
					{#if detail}
						{#if detail.fileId}
							<a
								href={resolve(`/api/files/${detail.fileId}`)}
								target="_blank"
								class="text-blue-600 underline hover:text-blue-800 dark:text-blue-400"
								data-testid="detail-statement"
							>
								{statementLabel}
							</a>
						{:else}
							<span data-testid="detail-statement">{statementLabel}</span>
						{/if}
					{:else}
						<span class="animate-pulse rounded bg-gray-200 dark:bg-gray-700"
							>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span
						>
					{/if}
				</div>
				<div class="flex justify-between">
					<span class="font-medium">Bank Description</span>
					<span class="max-w-[60%] text-right font-mono" data-testid="detail-bank-description"
						>{bankDescription.text}</span
					>
				</div>
				<div class="flex justify-between">
					<span class="font-medium">Amount</span>
					<span data-testid="detail-amount">{formatTransactionAmount(transaction.amount)}</span>
				</div>
			</div>

			<hr class="my-4 border-gray-200 dark:border-gray-700" />

			<!-- Editable section -->
			<div class="space-y-4">
				<div>
					<label
						for="modal-description"
						class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
					>
						Description
					</label>
					<input
						bind:this={descriptionInput}
						id="modal-description"
						type="text"
						class="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
						bind:value={descriptionValue}
						onblur={handleDescriptionBlur}
						onkeydown={handleDescriptionKeydown}
						aria-label="Transaction description"
					/>
				</div>

				<div>
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
						Tags
					</label>
					<TagInput
						bind:this={tagInput}
						tags={transaction.tagged}
						availableTags={s.tags}
						onchange={handleTagsChange}
					/>
				</div>

				<div>
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label class="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
						Category
					</label>
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div onclick={(e) => e.stopPropagation()}>
						<CategorySelect
							bind:isOpen={isSelectingCategory}
							bind:value={
								() => categories.find((c) => c.id === transaction.categoryId),
								(newCategory) => setCategory(newCategory)
							}
							{categories}
						>
							{#snippet trigger(isOpen, setIsOpen)}
								<button
									type="button"
									onclick={() => setIsOpen(!isOpen)}
									class="flex w-full cursor-pointer items-center justify-between rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
								>
									<CategoryPill category={currentCategory ?? NONE_CATEGORY} style="full" />
									<svg class="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
										<path
											fill-rule="evenodd"
											d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
											clip-rule="evenodd"
										/>
									</svg>
								</button>
							{/snippet}
						</CategorySelect>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
