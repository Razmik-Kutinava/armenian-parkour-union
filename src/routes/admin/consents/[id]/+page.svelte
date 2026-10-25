<script lang="ts">
	import { newsDate } from '#lib/components/site/news-date.ts';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import ConsentStatus from '../ConsentStatus.svelte';
	import ReviewForms from './ReviewForms.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const card = $derived(data.card);
	const m = $derived(card.member);
	const day = (d: Date | null) => (d ? newsDate(d, currentLocale()) : '—');
	const dl = 'grid gap-x-6 gap-y-2 sm:grid-cols-[12rem_1fr]';
</script>

<svelte:head><title>{t(`consents.kind.${card.kind}`)} — {t('admin.title')}</title></svelte:head>

<div class="mb-4 flex flex-wrap items-center gap-3">
	<h1 class="text-2xl font-bold">{t(`consents.kind.${card.kind}`)}: {m.name}</h1>
	<ConsentStatus status={card.status} />
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
	<section class="flex flex-col gap-3">
		<h2 class="text-lg font-bold">{t('consents.card.member')}</h2>
		<dl class={dl}>
			<dt class="font-bold">{t('consents.card.member')}</dt>
			<dd><a class="text-navy-700 underline" href="/admin/users/{m.id}">{m.name}</a></dd>
			<dt class="font-bold">{t('consents.card.age')}</dt>
			<dd>{m.age ?? '—'}</dd>
			{#if m.email}
				<dt class="font-bold">{t('consents.card.email')}</dt>
				<dd>{m.email}</dd>
			{/if}
			<dt class="font-bold">{t('consents.card.guardian')}</dt>
			<dd>{m.guardianName ?? '—'}</dd>
			<dt class="font-bold">{t('consents.card.phone')}</dt>
			<dd>{m.guardianPhone ?? '—'}</dd>
			<dt class="font-bold">{t('consents.card.email')}</dt>
			<dd>{m.guardianEmail ?? '—'}</dd>
		</dl>
	</section>

	<section class="flex flex-col gap-3">
		<h2 class="text-lg font-bold">{t('consents.card.document')}</h2>
		<dl class={dl}>
			<dt class="font-bold">{t('consents.card.signedBy')}</dt>
			<dd>{card.guardianName ?? '—'}</dd>
			<dt class="font-bold">{t('consents.col.signedAt')}</dt>
			<dd>{day(card.signedAt)}</dd>
			<dt class="font-bold">{t('consents.card.uploaded')}</dt>
			<dd>{day(card.updatedAt)}</dd>
			<dt class="font-bold">{t('consents.col.validUntil')}</dt>
			<dd>
				{card.status === 'approved' && !card.validUntil
					? t('consents.noEnd')
					: day(card.validUntil)}
			</dd>
			{#if card.reviewerName}
				<dt class="font-bold">{t('consents.card.reviewer')}</dt>
				<dd>{card.reviewerName}</dd>
			{/if}
			{#if card.reviewNote}
				<dt class="font-bold">{t('consents.form.note')}</dt>
				<dd>{card.reviewNote}</dd>
			{/if}
		</dl>
		{#if card.fileUrl}
			<p>
				<a
					class="font-bold text-navy-700 underline"
					href={card.fileUrl}
					target="_blank"
					rel="noopener noreferrer">{t('consents.view')}</a
				>
				<span class="text-sm text-ink-700">{t('consents.card.fileHint')}</span>
			</p>
		{:else}
			<p class="text-sm text-ink-700">{t('consents.card.noFile')}</p>
		{/if}
	</section>

	{#if card.status === 'pending'}<ReviewForms />{/if}
</div>
