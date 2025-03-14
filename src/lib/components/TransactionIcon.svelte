<script lang="ts">
	let { path, alt }: { path: string; alt: string } = $props();
</script>

<img src={path} {alt} class="h-4 w-4 dark:grayscale dark:invert" />
