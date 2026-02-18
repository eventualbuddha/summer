<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import NavigationButton from '$lib/components/NavigationButton.svelte';
	import type { State } from '$lib/state.svelte';
	import { getContext } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';

	let s: State = getContext('state');

	// Selection
	let selectedIds = new SvelteSet<string>();
	const selectedTags = $derived(s.tags.filter((t) => selectedIds.has(t.id)));
	const allSelected = $derived(s.tags.length > 0 && selectedIds.size === s.tags.length);
	const someSelected = $derived(selectedIds.size > 0 && selectedIds.size < s.tags.length);
	const canDelete = $derived(selectedIds.size > 0);
	const canMerge = $derived(selectedIds.size >= 2);

	let headerCheckbox = $state<HTMLInputElement>();
	$effect(() => {
		if (headerCheckbox) headerCheckbox.indeterminate = someSelected;
	});

	function toggleAll() {
		if (allSelected) {
			selectedIds.clear();
		} else {
			for (const tag of s.tags) selectedIds.add(tag.id);
		}
	}

	function toggleTag(id: string) {
		if (selectedIds.has(id)) {
			selectedIds.delete(id);
		} else {
			selectedIds.add(id);
		}
	}

	// Rename
	async function handleRename(tagId: string, newName: string) {
		const trimmed = newName.trim();
		if (!trimmed) return;
		try {
			await s.renameTag(tagId, trimmed);
		} catch (error) {
			s.lastError = error as Error;
		}
	}

	// Delete dialog
	let deleteDialog = $state<HTMLDialogElement>();
	let isDeleting = $state(false);

	function openDeleteDialog() {
		deleteDialog?.showModal();
	}

	async function confirmDelete() {
		isDeleting = true;
		try {
			await s.deleteTags([...selectedIds]);
			selectedIds.clear();
			deleteDialog?.close();
		} catch (error) {
			s.lastError = error as Error;
		} finally {
			isDeleting = false;
		}
	}

	// Merge dialog
	let mergeDialog = $state<HTMLDialogElement>();
	let mergeTargetId = $state('');
	let isMerging = $state(false);

	function openMergeDialog() {
		mergeTargetId = selectedTags[0]?.id ?? '';
		mergeDialog?.showModal();
	}

	const mergeSourceTags = $derived(selectedTags.filter((t) => t.id !== mergeTargetId));

	async function confirmMerge() {
		if (!mergeTargetId || mergeSourceTags.length === 0) return;
		isMerging = true;
		try {
			await s.mergeTags(
				mergeSourceTags.map((t) => t.id),
				mergeTargetId
			);
			selectedIds.clear();
			mergeDialog?.close();
		} catch (error) {
			s.lastError = error as Error;
		} finally {
			isMerging = false;
		}
	}
</script>

<div class="flex flex-row items-center gap-4">
	<NavigationButton />
	<h1 class="text-2xl font-bold">Tags</h1>
</div>

{#if s.tags.length === 0}
	<div class="no-tags">
		<p>No tags found.</p>
		<p class="hint">Tags are created when you add them to transactions.</p>
	</div>
{:else}
	<div class="table-container">
		<table class="tags-table">
			<thead>
				<tr>
					<th class="checkbox-col">
						<input
							bind:this={headerCheckbox}
							type="checkbox"
							checked={allSelected}
							onchange={toggleAll}
							aria-label="Select all tags"
						/>
					</th>
					<th class="name-header">
						<div class="name-header-inner">
							<span>Tag</span>
							<div class="header-actions">
								{#if selectedIds.size > 0}
									<span class="count-label">{selectedIds.size} selected</span>
								{/if}
								<Button onclick={openDeleteDialog} disabled={!canDelete}>Delete</Button>
								<Button onclick={openMergeDialog} disabled={!canMerge}>Merge</Button>
							</div>
						</div>
					</th>
				</tr>
			</thead>
			<tbody>
				{#each s.tags as tag (tag.id)}
					<tr class="tag-row" class:selected={selectedIds.has(tag.id)}>
						<td class="checkbox-col">
							<input
								type="checkbox"
								checked={selectedIds.has(tag.id)}
								onchange={() => toggleTag(tag.id)}
								aria-label="Select {tag.name}"
							/>
						</td>
						<td class="name-cell">
							<input
								type="text"
								value={tag.name}
								onblur={(e) => {
									const newName = e.currentTarget.value.trim();
									if (newName && newName !== tag.name) {
										handleRename(tag.id, newName);
									}
								}}
								onkeydown={(e) => {
									if (e.key === 'Escape') {
										e.currentTarget.value = tag.name;
										e.currentTarget.blur();
									} else if (e.key === 'Enter') {
										e.currentTarget.blur();
									}
								}}
								class="name-input"
								aria-label="Tag name"
							/>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}

<!-- Delete confirmation dialog -->
<dialog bind:this={deleteDialog}>
	<h2>Delete {selectedTags.length} {selectedTags.length === 1 ? 'tag' : 'tags'}?</h2>
	<p>The following tags will be removed from all their transactions:</p>
	<ul>
		{#each selectedTags as tag (tag.id)}
			<li>
				<code>{tag.name}</code>
				({tag.transactionCount}
				{tag.transactionCount === 1 ? 'transaction' : 'transactions'})
			</li>
		{/each}
	</ul>
	<div class="dialog-actions">
		<Button onclick={() => deleteDialog?.close()} disabled={isDeleting}>Cancel</Button>
		<Button onclick={confirmDelete} disabled={isDeleting}>Delete</Button>
	</div>
</dialog>

<!-- Merge confirmation dialog -->
<dialog bind:this={mergeDialog}>
	<h2>Merge {selectedTags.length} tags</h2>
	<label class="merge-target-label">
		<span>Merge all selected tags into:</span>
		<select class="merge-select" bind:value={mergeTargetId} disabled={isMerging}>
			{#each selectedTags as tag (tag.id)}
				<option value={tag.id}>{tag.name}</option>
			{/each}
		</select>
	</label>
	{#if mergeSourceTags.length > 0}
		<p>The following tags will be removed:</p>
		<ul>
			{#each mergeSourceTags as tag (tag.id)}
				<li>
					<code>{tag.name}</code>
					({tag.transactionCount}
					{tag.transactionCount === 1 ? 'transaction' : 'transactions'})
				</li>
			{/each}
		</ul>
	{/if}
	<div class="dialog-actions">
		<Button onclick={() => mergeDialog?.close()} disabled={isMerging}>Cancel</Button>
		<Button onclick={confirmMerge} disabled={isMerging}>Merge</Button>
	</div>
</dialog>

<style>
	.count-label {
		font-size: 0.875rem;
		color: var(--text-secondary);
	}

	.no-tags {
		text-align: center;
		padding: 3rem 1rem;
		color: var(--text-secondary);
	}

	.no-tags p {
		margin: 0.5rem 0;
	}

	.hint {
		font-size: 0.875rem;
		color: var(--text-tertiary);
	}

	.table-container {
		overflow-x: auto;
		border: 1px solid var(--border-color);
		border-radius: 0.5rem;
		background: var(--background);
	}

	.tags-table {
		width: 100%;
		border-collapse: collapse;
	}

	.tags-table thead {
		position: sticky;
		top: 0;
		z-index: 1;
	}

	.tags-table th {
		padding: 0.75rem 1rem;
		text-align: left;
		font-weight: 600;
		border-bottom: 2px solid var(--border-color);
		white-space: nowrap;
		box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
	}

	.tags-table th {
		background: rgb(55 65 81);
		color: rgb(243 244 246);
	}

	@media (prefers-color-scheme: dark) {
		.tags-table th {
			background: rgb(31 41 55);
		}
	}

	th.checkbox-col,
	td.checkbox-col {
		width: 2.5rem;
		text-align: center;
		padding: 0.5rem 0.5rem 0.5rem 0.75rem;
	}

	.name-header-inner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-weight: normal;
	}

	.tags-table td {
		padding: 0.5rem 1rem;
		border-bottom: 1px solid var(--border-color-subtle);
		vertical-align: middle;
	}

	.tag-row:hover {
		background: var(--background-hover);
	}

	.tag-row.selected {
		background: var(--accent-background);
	}

	.tag-row.selected:hover {
		background: var(--accent-background);
		filter: brightness(0.97);
	}

	.name-input {
		font-family: monospace;
		font-size: 0.9rem;
		padding: 0.25rem 0.375rem;
		border-radius: 0.375rem;
		border: 1px solid transparent;
		background: transparent;
		color: var(--text-primary);
		text-align: left;
		width: 100%;
	}

	.name-input:hover {
		border-color: var(--border-color);
	}

	.name-input:focus {
		outline: none;
		border-color: var(--accent-color);
		box-shadow: 0 0 0 1px var(--accent-color);
	}

	/* Dialogs */
	dialog {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		margin: 0;
		border-radius: 0.5rem;
		padding: 1.5rem;
		max-width: 28rem;
		width: 90%;
		background: white;
		color: rgb(17 24 39);
		border: 1px solid rgb(209 213 219);
		box-shadow:
			0 20px 25px -5px rgb(0 0 0 / 0.2),
			0 8px 10px -6px rgb(0 0 0 / 0.15);
	}

	@media (prefers-color-scheme: dark) {
		dialog {
			background: rgb(31 41 55);
			color: rgb(243 244 246);
			border: 1px solid rgb(55 65 81);
		}
	}

	dialog::backdrop {
		background: rgb(0 0 0 / 0.5);
	}

	dialog h2 {
		font-size: 1.125rem;
		font-weight: 600;
		margin: 0 0 0.75rem;
	}

	dialog p {
		margin: 0.75rem 0 0.25rem;
		font-size: 0.9rem;
		color: rgb(75 85 99);
	}

	@media (prefers-color-scheme: dark) {
		dialog p {
			color: rgb(156 163 175);
		}
	}

	dialog ul {
		margin: 0.25rem 0 0.75rem;
		padding-left: 1.25rem;
		font-size: 0.9rem;
	}

	dialog ul li {
		margin: 0.25rem 0;
	}

	dialog code {
		font-family: monospace;
		padding: 0.1rem 0.3rem;
		border-radius: 0.25rem;
		font-size: 0.875em;
		background: rgb(243 244 246);
	}

	@media (prefers-color-scheme: dark) {
		dialog code {
			background: rgb(55 65 81);
		}
	}

	.merge-target-label {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		margin: 0.5rem 0;
		font-size: 0.9rem;
		color: rgb(75 85 99);
	}

	@media (prefers-color-scheme: dark) {
		.merge-target-label {
			color: rgb(156 163 175);
		}
	}

	.merge-select {
		font-size: 0.9rem;
		padding: 0.375rem 0.5rem;
		border-radius: 0.375rem;
		width: 100%;
		background: white;
		color: rgb(17 24 39);
		border: 1px solid rgb(209 213 219);
	}

	@media (prefers-color-scheme: dark) {
		.merge-select {
			background: rgb(17 24 39);
			color: rgb(243 244 246);
			border: 1px solid rgb(75 85 99);
		}
	}

	.dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 1.25rem;
	}
</style>
