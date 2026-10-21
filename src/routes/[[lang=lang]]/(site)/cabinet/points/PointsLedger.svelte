<script lang="ts">
	import Badge from '#lib/components/ui/Badge.svelte';
	import { newsDate } from '#lib/components/site/news-date.ts';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import type { OwnPointsEntry } from '#lib/server/services/cabinet/points.ts';

	/* docs/06 section 5.6: date, reason, source, amount, comment; entries are never edited, only
	 * reversed (docs/03 section 6.3). The staff member who made an entry is not shown. */
	let { rows }: { rows: OwnPointsEntry[] } = $props();
	const cell = 'px-3 py-2 text-left align-top';
	const SOURCES = ['certificate', 'event_registration', 'video'] as const;
	const date = (d: Date) => newsDate(d, currentLocale());
	function source(row: OwnPointsEntry): string {
		if (row.reversalOf) return t('cabinet.points.reversalOf', { date: date(row.reversalOf) });
		if (row.reason === 'manual') return t('cabinet.points.source.manual');
		const known = SOURCES.find((s) => s === row.sourceType);
		return known ? t(`cabinet.points.source.${known}`) : '';
	}
</script>

<div class="overflow-x-auto rounded-md border border-line bg-surface">
	<table class="w-full text-sm">
		<thead class="border-b border-line text-ink-700">
			<tr>
				<th class={cell} scope="col">{t('points.col.date')}</th>
				<th class={cell} scope="col">{t('points.col.reason')}</th>
				<th class={cell} scope="col">{t('points.col.source')}</th>
				<th class="{cell} text-right" scope="col">{t('points.col.delta')}</th>
				<th class={cell} scope="col">{t('points.col.comment')}</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-line">
			{#each rows as row (row.id)}
				<tr>
					<td class="{cell} whitespace-nowrap">{date(row.createdAt)}</td>
					<td class={cell}>
						{t(`points.reason.${row.reason}`)}
						{#if row.reversed}<Badge tone="warning">{t('points.reversed')}</Badge>{/if}
					</td>
					<td class={cell}>{source(row)}</td>
					<td
						class="{cell} text-right font-bold whitespace-nowrap {row.delta > 0
							? 'text-success-fg'
							: 'text-error-fg'}">{row.delta > 0 ? `+${row.delta}` : row.delta}</td
					>
					<td class="{cell} break-words">{row.comment ?? ''}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
