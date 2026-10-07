<script lang="ts">
	import ErrorView from '#lib/components/site/ErrorView.svelte';
</script>

<!-- Unknown URLs and errors outside the site layout (admin, layout load) land here. -->
<main id="content" class="flex min-h-screen items-center bg-bg">
	<ErrorView />
</main>
