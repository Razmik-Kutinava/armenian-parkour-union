<script lang="ts">
	/** Size and shape come from the caller, e.g. class="h-4 w-1/2" or class="size-10 rounded-full". */
	let { class: className = '' }: { class?: string } = $props();
</script>

<div
	class="animate-pulse rounded-sm bg-navy-100 motion-reduce:animate-none {className}"
	aria-hidden="true"
></div>
