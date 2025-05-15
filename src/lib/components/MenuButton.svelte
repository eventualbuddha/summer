<script lang="ts">
	import type { AriaRole } from 'svelte/elements';

	let { isOpen, role }: { isOpen: boolean; role?: AriaRole } = $props();
</script>

<div
	{role}
	class="flex flex-col items-center justify-center"
	onfocus={(e) => e.currentTarget.blur()}
>
	<span
		class="block h-0.5 w-6 rounded-sm bg-black transition-all
                    duration-300 ease-out dark:bg-white {isOpen
			? 'translate-y-1 rotate-45'
			: '-translate-y-0.5'}"
	>
	</span>
	<span
		class="my-0.5 block h-0.5 w-6 rounded-sm
                    bg-black transition-all duration-300 ease-out dark:bg-white {isOpen
			? 'opacity-0'
			: 'opacity-100'}"
	>
	</span>
	<span
		class="block h-0.5 w-6 rounded-sm bg-black transition-all
                    duration-300 ease-out dark:bg-white {isOpen
			? '-translate-y-1 -rotate-45'
			: 'translate-y-0.5'}"
	>
	</span>
</div>
