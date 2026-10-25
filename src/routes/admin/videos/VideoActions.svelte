<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import Button from '#lib/components/ui/Button.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';

	/* docs/05 section 11: quick buttons of one row or of the selection; the refusal asks for a reason
	 * in the page dialog. The server re-checks the status and the right. */
	let {
		ids,
		approve = false,
		hide = false,
		labels = 'row',
		onReject,
		after
	}: {
		ids: string[];
		approve?: boolean;
		hide?: boolean;
		labels?: 'row' | 'selected';
		onReject?: () => void;
		after: SubmitFunction;
	} = $props();

	const label = (action: 'approve' | 'reject' | 'hide') =>
		t(labels === 'row' ? `videos.admin.${action}` : `videos.admin.${action}Selected`);
</script>

<div class="flex flex-wrap gap-2">
	{#if approve}
		<form method="POST" action="?/approve" use:enhance={after}>
			{#each ids as id (id)}<input type="hidden" name="ids" value={id} />{/each}
			<Button type="submit" size="sm">{label('approve')}</Button>
		</form>
	{/if}
	{#if onReject}
		<Button size="sm" variant="danger" onclick={onReject}>{label('reject')}</Button>
	{/if}
	{#if hide}
		<form method="POST" action="?/hide" use:enhance={after}>
			{#each ids as id (id)}<input type="hidden" name="ids" value={id} />{/each}
			<Button type="submit" size="sm" variant="secondary">{label('hide')}</Button>
		</form>
	{/if}
</div>
