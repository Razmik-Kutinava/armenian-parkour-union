<script lang="ts">
	import Badge from '#lib/components/ui/Badge.svelte';
	import { newsDate } from '#lib/components/site/news-date.ts';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import type { OwnExam } from '#lib/server/services/cabinet/progress.ts';

	/* docs/06 section 5.5: scheduled and decided exams — type, date, result, score. */
	let { exams }: { exams: OwnExam[] } = $props();
	const cell = 'px-3 py-2 text-left align-top';
	const tones = {
		scheduled: 'info',
		passed: 'success',
		failed: 'error',
		cancelled: 'neutral'
	} as const;
	const day = (d: Date | null) => (d ? newsDate(d, currentLocale()) : '—');
</script>

<div class="overflow-x-auto rounded-md border border-line bg-surface">
	<table class="w-full text-sm">
		<thead class="border-b border-line text-ink-700">
			<tr>
				<th class={cell} scope="col">{t('exams.col.kind')}</th>
				<th class={cell} scope="col">{t('exams.col.date')}</th>
				<th class={cell} scope="col">{t('exams.col.result')}</th>
				<th class="{cell} text-right" scope="col">{t('exams.col.score')}</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-line">
			{#each exams as exam (exam.id)}
				<tr>
					<td class={cell}>{t(`exams.kind.${exam.kind}`)}</td>
					<td class="{cell} whitespace-nowrap">{day(exam.scheduledAt ?? exam.decidedAt)}</td>
					<td class={cell}>
						<Badge tone={tones[exam.result]}>{t(`exams.result.${exam.result}`)}</Badge>
					</td>
					<td class="{cell} text-right">{exam.score ?? '—'}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
