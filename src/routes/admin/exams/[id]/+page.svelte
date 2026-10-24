<script lang="ts">
	import { eventMoment } from '#lib/components/site/event-date.ts';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import ExamResult from '../ExamResult.svelte';
	import ResultForm from './ResultForm.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 7: the exam and, while it is scheduled, the result form. */
	let { data, form }: PageProps = $props();
	const card = $derived(data.card);
	const moment = (d: Date | null) => (d ? eventMoment(d, currentLocale()) : '—');
	const dl = 'grid gap-x-6 gap-y-2 sm:grid-cols-[12rem_1fr]';
	const retake = $derived(card.result === 'failed' || card.result === 'cancelled');
</script>

<svelte:head><title>{t(`exams.kind.${card.kind}`)} — {t('admin.title')}</title></svelte:head>

<div class="mb-4 flex flex-wrap items-center gap-3">
	<h1 class="text-2xl font-bold">{t(`exams.kind.${card.kind}`)}: {card.memberName}</h1>
	<ExamResult result={card.result} />
</div>

{#if form?.done}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t(form.done)}
	</p>
{:else if form?.message}
	<p role="alert" class="mb-4 rounded-md bg-error-bg p-3 text-sm text-error-fg">
		{t(form.message)}
	</p>
{/if}

<div class="flex max-w-3xl flex-col gap-6">
	<dl class={dl}>
		<dt class="font-bold">{t('exams.card.member')}</dt>
		<dd>
			<a class="text-navy-700 underline" href="/admin/users/{card.userId}">{card.memberName}</a>
			<span class="text-ink-700">
				· {card.memberLevel ? t(`level.${card.memberLevel}`) : t('exams.new.noLevel')}</span
			>
		</dd>
		<dt class="font-bold">{t('exams.col.date')}</dt>
		<dd>{moment(card.scheduledAt)}</dd>
		<dt class="font-bold">{t('exams.card.event')}</dt>
		<dd>{card.eventTitle ? pickLocalized(card.eventTitle, currentLocale()) : '—'}</dd>
		<dt class="font-bold">{t('exams.col.examiner')}</dt>
		<dd>{card.examinerName ?? '—'}</dd>
		<dt class="font-bold">{t('exams.card.notes')}</dt>
		<dd class="whitespace-pre-line">{card.notes ?? '—'}</dd>
		<dt class="font-bold">{t('exams.col.score')}</dt>
		<dd>{card.score ?? '—'}</dd>
		<dt class="font-bold">{t('exams.card.decidedAt')}</dt>
		<dd>{moment(card.decidedAt)}</dd>
	</dl>

	{#if card.result === 'scheduled'}
		<ResultForm values={form?.values} errors={form?.errors} />
	{:else if data.certificate}
		<p>
			<span class="font-bold">{t('exams.card.certificate')}:</span>
			<a class="text-navy-700 underline" href="/admin/certificates/{data.certificate.id}"
				>{data.certificate.number}</a
			>
		</p>
	{:else if card.result === 'passed' && data.canIssue}
		<a
			class="text-white inline-flex min-h-11 w-fit items-center rounded-md bg-navy-700 px-4 font-bold hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 sm:min-h-10"
			href="/admin/certificates/new?exam={card.id}">{t('exams.card.issue')}</a
		>
	{:else if retake}
		<a
			class="w-fit font-bold text-navy-700 underline"
			href="/admin/exams/new?member={card.userId}&kind={card.kind}">{t('exams.card.retake')}</a
		>
	{/if}
</div>
