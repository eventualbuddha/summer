<script lang="ts">
	import { tick } from 'svelte';
	import type { Snippet } from 'svelte';
	import type { ClassValue } from 'svelte/elements';

	let {
		root,
		trigger,
		portal,
		open: isOpen = $bindable(false),
		'content-class': contentClass
	}: {
		root: Snippet<[Snippet]>;
		trigger: Snippet<[boolean, (isOpen: boolean) => void]>;
		portal: Snippet;
		open?: boolean;
		'content-class'?: ClassValue;
	} = $props();

	let popoverElement: HTMLDivElement | undefined = $state();
	let containerElement: HTMLDivElement | undefined = $state();

	// Sync isOpen state with the popover element
	$effect(() => {
		if (!popoverElement) return;
		if (isOpen) {
			popoverElement.showPopover();
			// Position after content renders (portal is conditionally rendered)
			tick().then(() => positionPopover());
		} else {
			popoverElement.hidePopover();
		}
	});

	function positionPopover() {
		if (!popoverElement || !containerElement) return;

		// Find the portal content element (last child of the popover, after the overlay)
		const portalWrapper = popoverElement.querySelector('[data-dropdown-content]');
		// Get the actual content — the portal's child which may be absolutely positioned
		const portalContent = portalWrapper?.firstElementChild;
		if (!portalContent) return;

		const triggerRect = containerElement.getBoundingClientRect();
		const contentRect = portalContent.getBoundingClientRect();

		// Check if the popover fits below the trigger
		const fitsBelow = triggerRect.bottom + contentRect.height <= window.innerHeight;

		// Vertical positioning
		if (fitsBelow) {
			popoverElement.style.top = `${triggerRect.bottom}px`;
		} else {
			popoverElement.style.top = `${triggerRect.top - contentRect.height}px`;
		}

		// Horizontal positioning: prefer aligning left with the trigger,
		// but keep the popover within the viewport width.
		const fitsRight = triggerRect.left + contentRect.width <= window.innerWidth;
		const left = fitsRight
			? triggerRect.left
			: Math.max(0, triggerRect.right - contentRect.width);

		popoverElement.style.left = `${left}px`;
	}

	// Close on scroll of any ancestor
	$effect(() => {
		if (!isOpen || !containerElement) return;

		function onScroll() {
			isOpen = false;
		}

		// Walk up the DOM and attach scroll listeners to all scrollable ancestors
		const scrollParents: EventTarget[] = [];
		let node: Element | null = containerElement.parentElement;
		while (node) {
			if (node.scrollHeight > node.clientHeight) {
				scrollParents.push(node);
			}
			node = node.parentElement;
		}
		scrollParents.push(document, window);

		for (const parent of scrollParents) {
			parent.addEventListener('scroll', onScroll, { passive: true });
		}

		return () => {
			for (const parent of scrollParents) {
				parent.removeEventListener('scroll', onScroll);
			}
		};
	});
</script>

{#snippet rootContents()}
	<div class={contentClass} bind:this={containerElement}>
		{@render trigger(isOpen, (newIsOpen) => {
			isOpen = newIsOpen;
		})}

		<div
			bind:this={popoverElement}
			popover="manual"
			style="inset: unset; position: fixed; margin: 0; padding: 0; border: none; background: none; overflow: visible;"
		>
			{#if isOpen}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="fixed inset-0"
					onpointerdown={(e) => {
						e.stopPropagation();
						isOpen = false;
					}}
				></div>
				<div data-dropdown-content>
					{@render portal()}
				</div>
			{/if}
		</div>
	</div>
{/snippet}

{@render root(rootContents)}
