<script lang="ts">
	import '../app.css';
	let { children } = $props();
</script>

<div class="flex h-screen w-screen flex-col gap-4 overflow-hidden p-4">
	{@render children()}
</div>
