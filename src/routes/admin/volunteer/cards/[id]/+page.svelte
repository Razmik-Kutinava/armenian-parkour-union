<script lang="ts">
	import { newsDate } from '#lib/components/site/news-date.ts';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import CardStatus from '../CardStatus.svelte';
	import CardActions from './CardActions.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 28 "Cards", the card; decisions — docs/todo.md 10.3 (8). */
	let { data, form }: PageProps = $props();
	const card = $derived(data.card);
	const m = $derived(card.member);
	const day = (d: Date | null) => (d ? newsDate(d, currentLocale()) : '—');
	const dl = 'grid gap-x-6 gap-y-2 sm:grid-cols-[12rem_1fr]';
</script>

<svelte:head
	><title>{m.name} — {t('admin.nav.volunteerCards')} — {t('admin.title')}</title></svelte:head
>

<a class="mb-4 inline-block text-sm text-navy-700 underline" href="/admin/volunteer/cards"
	>{t('volunteerCards.card.back')}</a
>
<div class="mb-4 flex flex-wrap items-center gap-3">
	<h1 class="text-2xl font-bold">{m.name}</h1>
	<CardStatus status={card.status} />
</div>

{#if form?.done}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t('volunteerCards.saved')}
	</p>
{:else if form?.missing}
	<div role="alert" class="mb-4 rounded-md bg-error-bg p-3 text-sm text-error-fg">
		<p>{t('volunteerCards.error.conditions')}</p>
		<ul class="list-disc pl-5">
			{#each form.missing as item (item)}<li>{t(`volunteerCards.missing.${item}`)}</li>{/each}
		</ul>
	</div>
{:else if form?.message}
	<p role="alert" class="mb-4 rounded-md bg-error-bg p-3 text-sm text-error-fg">
		{t(form.message)}
	</p>
{/if}

<div class="flex max-w-3xl flex-col gap-6">
	<section class="flex flex-col gap-3">
		<h2 class="text-lg font-bold">{t('volunteerCards.card.member')}</h2>
		<div class="flex flex-wrap gap-6">
			{#if m.photoUrl}
				<img
					src={m.photoUrl}
					alt={t('volunteerCards.card.photo')}
					class="h-40 w-32 rounded-md object-cover"
				/>
			{:else}
				<p class="text-sm text-ink-700">{t('volunteerCards.card.noPhoto')}</p>
			{/if}
			<dl class={dl}>
				<dt class="font-bold">{t('volunteerCards.card.member')}</dt>
				<dd><a class="text-navy-700 underline" href="/admin/users/{m.id}">{m.name}</a></dd>
				<dt class="font-bold">{t('volunteerCards.col.age')}</dt>
				<dd>{m.age ?? '—'}</dd>
				<dt class="font-bold">{t('volunteerCards.card.email')}</dt>
				<dd>{m.email}</dd>
			</dl>
		</div>
	</section>

	<section class="flex flex-col gap-3">
		<h2 class="text-lg font-bold">{t('volunteerCards.card.data')}</h2>
		<dl class={dl}>
			<dt class="font-bold">{t('volunteerCards.col.number')}</dt>
			<dd>{card.number ?? '—'}</dd>
			<dt class="font-bold">{t('volunteerCards.card.applied')}</dt>
			<dd>{day(card.appliedAt)}</dd>
			<dt class="font-bold">{t('volunteerCards.card.issued')}</dt>
			<dd>{day(card.issuedAt)}</dd>
			{#if card.reviewerName}
				<dt class="font-bold">{t('volunteerCards.card.reviewer')}</dt>
				<dd>{card.reviewerName}, {day(card.reviewedAt)}</dd>
			{/if}
			{#if card.reviewNote}
				<dt class="font-bold">{t('volunteerCards.card.note')}</dt>
				<dd>{card.reviewNote}</dd>
			{/if}
			<dt class="font-bold">{t('volunteerCards.col.membership')}</dt>
			<dd>{day(card.paidUntil)}</dd>
			<dt class="font-bold">{t('volunteerCards.col.valid')}</dt>
			<dd>
				{#if card.validity.valid}
					{t('volunteerCards.card.validUntil')} {day(card.validity.until)}
				{:else}
					{t('volunteerCards.card.notValid')}:
					{card.validity.reasons.map((r) => t(`volunteerCards.invalid.${r}`)).join(', ')}
				{/if}
			</dd>
			<dt class="font-bold">{t('volunteerCards.col.streak')}</dt>
			<dd>{card.declineStreak}{card.flagged ? ` — ${t('volunteerCards.flagged')}` : ''}</dd>
			{#if data.checkUrl}
				<dt class="font-bold">{t('volunteerCards.card.checkPage')}</dt>
				<dd>
					<a
						class="break-all text-navy-700 underline"
						href={data.checkUrl}
						target="_blank"
						rel="noopener noreferrer">{data.checkUrl}</a
					>
				</dd>
			{/if}
		</dl>
	</section>

	<CardActions status={card.status} />
</div>
