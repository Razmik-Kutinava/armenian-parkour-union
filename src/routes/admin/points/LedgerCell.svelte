<script lang="ts">
	import Badge from '#lib/components/ui/Badge.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { PointsListRow } from '#lib/server/services/points/admin-list.ts';

	/* One cell of the points ledger (docs/05 section 12): read-only text, no actions. */
	let { row, key }: { row: PointsListRow; key: string } = $props();
</script>

{#if key === 'member'}
	<a
		class="font-bold text-navy-700 underline-offset-2 hover:underline"
		href="/admin/users/{row.userId}">{row.userName ?? row.userEmail ?? row.userId.slice(0, 8)}</a
	>
	{#if row.userEmail}<span class="block text-xs text-ink-500">{row.userEmail}</span>{/if}
{:else if key === 'delta'}
	<span class="font-bold {row.delta > 0 ? 'text-success-fg' : 'text-error-fg'}"
		>{row.delta > 0 ? `+${row.delta}` : row.delta}</span
	>
{:else if key === 'reason'}
	{t(`points.reason.${row.reason}`)}
	{#if row.reversedById}<Badge tone="warning">{t('points.reversed')}</Badge>{/if}
{:else if key === 'source'}
	{#if row.sourceType}
		<span class="font-mono text-xs">{row.sourceType}</span>
		{#if row.sourceId}<span class="font-mono block text-xs text-ink-500"
				>{row.sourceId.slice(0, 8)}</span
			>{/if}
	{/if}
{:else if key === 'comment'}
	<span class="break-words">{row.comment ?? ''}</span>
{:else if key === 'author'}
	{row.createdByName ?? t('points.system')}
{/if}
