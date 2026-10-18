<script lang="ts">
	import { currentLocale, t, type Locale, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import LanguageSwitcher from './LanguageSwitcher.svelte';
	import ParkourVideo from './ParkourVideo.svelte';

	const phone = '+374 77 253039';
	const email = 'info@parkour.am';
	const posters: Record<Locale, string> = {
		en: '/fest/yerevan-parkour-fest-2027-poster-en.png',
		hy: '/fest/yerevan-parkour-fest-2027-poster-hy.png',
		ru: '/fest/yerevan-parkour-fest-2027-poster.png'
	};
	const poster = $derived(posters[currentLocale()]);
	const lists: { title: MessageKey; items: MessageKey[] }[] = [
		{ title: 'fest.goalsTitle', items: ['fest.goal1', 'fest.goal2', 'fest.goal3', 'fest.goal4'] },
		{ title: 'fest.planTitle', items: ['fest.plan1', 'fest.plan2', 'fest.plan3', 'fest.plan4'] }
	];
</script>

<section class="relative isolate overflow-hidden bg-navy-950 text-surface">
	<img
		src="/fest/yerevan-parkour-fest-2027.jpg"
		alt={t('fest.imageAlt')}
		class="absolute inset-0 -z-10 h-full w-full object-cover object-right"
	/>
	<div
		class="absolute inset-0 -z-10 bg-gradient-to-r from-navy-950/95 via-navy-950/70 to-transparent"
	></div>
	<div class="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-20 md:py-28">
		<LanguageSwitcher surface="dark" />
		<p class="text-sm font-bold tracking-widest text-accent-500 uppercase">{t('fest.kicker')}</p>
		<h2 class="md:text-6xl max-w-xl text-4xl font-bold">{t('fest.title')}</h2>
		<p class="text-xl md:text-2xl">{t('fest.subtitle')}</p>
		<p class="text-2xl font-bold text-accent-500 md:text-3xl">{t('fest.dates')}</p>
		<p class="text-sm text-navy-300">{t('fest.datesNote')}</p>
	</div>
</section>

<ParkourVideo />

<section class="mx-auto flex max-w-4xl flex-col gap-10 px-6 py-14 text-ink-700">
	<div class="grid items-start gap-8 md:grid-cols-[1fr_16rem]">
		<div class="flex flex-col gap-4">
			<p class="text-lg">{t('fest.lead')}</p>
			<p class="rounded-md border-l-4 border-accent-500 bg-navy-950/5 px-4 py-3">
				{t('fest.draftNote')}
			</p>
		</div>
		<a href={poster} target="_blank" rel="noopener" class="mx-auto block w-64 md:w-full">
			<img
				src={poster}
				alt={t('fest.posterAlt')}
				width="571"
				height="1024"
				loading="lazy"
				class="h-auto w-full rounded-md shadow-lg"
			/>
		</a>
	</div>

	<div class="grid gap-8 md:grid-cols-2">
		{#each lists as list (list.title)}
			<div class="flex flex-col gap-3">
				<h2 class="text-2xl font-bold text-navy-700">{t(list.title)}</h2>
				<ul class="flex list-disc flex-col gap-2 pl-5">
					{#each list.items as item (item)}
						<li>{t(item)}</li>
					{/each}
				</ul>
			</div>
		{/each}
	</div>

	<div class="flex flex-col gap-3">
		<h2 class="text-2xl font-bold text-navy-700">{t('fest.guestTitle')}</h2>
		<p>{t('fest.guestText')}</p>
	</div>

	<div class="flex flex-col gap-2">
		<h2 class="text-2xl font-bold text-navy-700">{t('fest.contactsTitle')}</h2>
		<p class="font-bold">{t('fest.organizer')}</p>
		<p>{t('fest.address')}</p>
		<p><a class="underline" href="tel:+37477253039">{phone}</a></p>
		<p><a class="underline" href="mailto:{email}">{email}</a></p>
		<p class="text-sm">{t('site.underConstruction')}</p>
	</div>
</section>
