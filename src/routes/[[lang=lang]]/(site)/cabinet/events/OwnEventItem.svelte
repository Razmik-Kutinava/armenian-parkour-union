<script lang="ts">
	import { eventDates, eventMoment } from '#lib/components/site/event-date.ts';
	import { currentLocale, localizePath, t } from '#lib/i18n/index.svelte.ts';
	import type { OwnEvent } from '#lib/server/services/cabinet/events.ts';
	import OwnEventActions from './OwnEventActions.svelte';

	/* docs/06 section 5.4: upcoming — status and buttons; past — place, score, points. */
	let { event, past }: { event: OwnEvent; past: boolean } = $props();
	const locale = $derived(currentLocale());
	const tone: Record<OwnEvent['status'], string> = {
		registered: 'bg-success-bg text-success-fg',
		attended: 'bg-success-bg text-success-fg',
		pending_payment: 'bg-info-bg text-info-fg',
		waitlist: 'bg-info-bg text-info-fg',
		cancelled: 'bg-navy-100 text-ink-700',
		no_show: 'bg-navy-100 text-ink-700'
	};
</script>

<li class="flex flex-col gap-2 p-4">
	<div class="flex flex-wrap items-baseline justify-between gap-2">
		{#if event.linked}
			<a
				class="font-bold text-navy-700 underline hover:no-underline"
				href={localizePath(`/events/${event.slug}`, locale)}>{event.title}</a
			>
		{:else}
			<span class="font-bold text-ink-900">{event.title}</span>
		{/if}
		<span class="rounded-md px-2 py-0.5 text-sm font-bold {tone[event.status]}">
			{t(`cabinet.events.status.${event.status}`)}
		</span>
	</div>
	<p class="text-sm text-ink-700">{eventDates(event.startsAt, event.endsAt, locale)}</p>
	{#if event.categoryName}
		<p class="text-sm text-ink-700">{t('cabinet.events.category', { name: event.categoryName })}</p>
	{/if}
	{#if event.eventCancelled}
		<p class="text-sm font-bold text-error-fg">{t('cabinet.events.eventCancelled')}</p>
	{/if}
	{#if past}
		<p class="flex flex-wrap gap-x-4 text-sm text-ink-900">
			{#if event.place !== null}<span>{t('cabinet.events.place', { place: event.place })}</span
				>{/if}
			{#if event.score !== null}<span>{t('cabinet.events.score', { score: event.score })}</span
				>{/if}
			<span>{t('cabinet.events.points', { points: event.points })}</span>
		</p>
	{:else}
		{#if event.canPay}
			<p class="text-sm text-ink-900">
				{t('cabinet.events.payUntil', { time: eventMoment(event.holdUntil!, locale) })}
			</p>
		{/if}
		{#if event.cancelUntil}
			<p class="text-sm text-ink-700">
				{t('registrations.cancelUntil', { date: eventMoment(event.cancelUntil, locale) })}
			</p>
		{/if}
		<OwnEventActions {event} />
	{/if}
</li>
