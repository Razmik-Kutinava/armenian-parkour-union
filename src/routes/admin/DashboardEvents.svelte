<script lang="ts">
	import { eventDates } from '#lib/components/site/event-date.ts';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import type { HeroNow, UpcomingEvent } from '#lib/server/services/dashboard/index.ts';
	import DashboardCard from './DashboardCard.svelte';

	/* docs/05 section 3: "Upcoming events" for everyone, "Home page now" for editor and admin. */
	let { upcoming, hero }: { upcoming: UpcomingEvent[]; hero: HeroNow[] | null } = $props();
	const locale = $derived(currentLocale());
	const link = 'font-bold text-navy-700 underline-offset-2 hover:underline';
</script>

<DashboardCard title={t('dashboard.upcoming')}>
	{#if upcoming.length === 0}
		<p class="text-ink-700">{t('dashboard.upcoming.none')}</p>
	{:else}
		<ul class="flex flex-col gap-3">
			{#each upcoming as event (event.id)}
				{@const title = pickLocalized(event.title, locale)}
				<li>
					{#if event.href}<a class={link} href={event.href}>{title}</a>{:else}<b>{title}</b>{/if}
					<p class="text-sm text-ink-700">{eventDates(event.startsAt, event.endsAt, locale)}</p>
					<p class="text-sm">
						{t('dashboard.upcoming.seats', {
							seats: String(event.seats),
							limit: event.capacity === null ? t('events.noLimit') : String(event.capacity)
						})}
						{#if event.waitlist > 0}
							· {t('dashboard.upcoming.waitlist', { count: String(event.waitlist) })}
						{/if}
					</p>
				</li>
			{/each}
		</ul>
	{/if}
</DashboardCard>

{#if hero}
	<DashboardCard title={t('dashboard.hero')}>
		{#if hero.length === 0}
			<p class="text-ink-700">{t('dashboard.hero.none')}</p>
		{:else}
			<ol class="mb-3 flex list-decimal flex-col gap-1 pl-5">
				{#each hero as block (block.id)}
					<li>
						{pickLocalized(block.title, locale) || t(`hero.type.${block.type}`)}
						<span class="text-sm text-ink-700">· {t(`hero.type.${block.type}`)}</span>
					</li>
				{/each}
			</ol>
		{/if}
		<a class={link} href="/admin/hero">{t('dashboard.hero.manage')}</a>
	</DashboardCard>
{/if}
