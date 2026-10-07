<script lang="ts">
	let { children } = $props();
</script>

<div class="flex items-start justify-center px-4 py-12 sm:items-center">
	<div class="w-full max-w-md rounded-lg bg-surface p-6 shadow-md sm:p-8">
		{@render children()}
	</div>
</div>
