<script lang="ts">
	import EventCard from '#lib/components/site/EventCard.svelte';
	import EventPager from '#lib/components/site/EventPager.svelte';
	import SeoHead from '#lib/components/site/SeoHead.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { localizePath } from '#lib/i18n/locales.ts';
	import { disciplines } from '#lib/validation/event-enums.ts';
	import type { PageProps } from './$types';

	/* docs/06 section 4.2: cards by date; filters city, period, price, discipline; archive link. */
	let { data }: PageProps = $props();
	const list = $derived(localizePath('/events', currentLocale()));
	const any = $derived({ value: '', label: t('filter.any') });
	const pageHref = (page: number) => {
		const q = new URLSearchParams(
			Object.entries({ ...data.filters, page: page > 1 ? String(page) : undefined }).filter(
				(e): e is [string, string] => !!e[1]
			)
		).toString();
		return q ? `${list}?${q}` : list;
	};
</script>

<SeoHead seo={data.seo} />

<div class="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10 sm:py-14">
	<div class="flex flex-wrap items-baseline justify-between gap-3">
		<h1 class="text-3xl font-bold text-ink-900 sm:text-4xl">{t('nav.events')}</h1>
		<a
			class="font-bold text-navy-700 underline-offset-2 hover:underline"
			href={localizePath('/events/archive', currentLocale())}>{t('events.list.archive')}</a
		>
	</div>

	<form method="GET" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
		<Select
			label={t('events.filter.city')}
			name="city"
			value={data.filters.city ?? ''}
			options={[any, ...data.cities.map((c) => ({ value: c, label: c }))]}
		/>
		<Select
			label={t('events.filter.period')}
			name="period"
			value={data.filters.period ?? ''}
			options={[
				any,
				...(['week', 'month', '3months'] as const).map((p) => ({
					value: p,
					label: t(`events.period.${p}`)
				}))
			]}
		/>
		<Select
			label={t('events.filter.price')}
			name="price"
			value={data.filters.price ?? ''}
			options={[
				any,
				...(['free', 'paid'] as const).map((p) => ({ value: p, label: t(`events.price.${p}`) }))
			]}
		/>
		<Select
			label={t('events.filter.discipline')}
			name="discipline"
			value={data.filters.discipline ?? ''}
			options={[any, ...disciplines.map((d) => ({ value: d, label: t(`events.discipline.${d}`) }))]}
		/>
		<Button type="submit" variant="secondary">{t('filter.apply')}</Button>
	</form>

	{#if data.events.length === 0}
		<p class="text-ink-700">{t('events.list.empty')}</p>
	{:else}
		<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.events as event, i (event.slug)}<EventCard {event} eager={i < 3} />{/each}
		</div>
	{/if}

	<EventPager page={data.page} pages={data.pages} href={pageHref} />
</div>
