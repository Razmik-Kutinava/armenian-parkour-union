<script lang="ts">
	import { currentLocale, localizePath, t } from '#lib/i18n/index.svelte.ts';
	import OwnEventItem from './OwnEventItem.svelte';
	import type { PageProps } from './$types';

	/* docs/06 section 5.4: two tabs as links, so they work without JavaScript and keep the address. */
	let { data, form }: PageProps = $props();
	const past = $derived(data.tab === 'past');
	const rows = $derived(past ? data.past : data.upcoming);
	const href = (path: string) => localizePath(path, currentLocale());
	const tab =
		'flex min-h-11 items-center rounded-md px-3 font-bold text-ink-700 hover:bg-navy-100 aria-[current=page]:bg-navy-900 aria-[current=page]:text-surface';
</script>

<svelte:head>
	<title>{t('cabinet.events.title')} — {t('site.name')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex max-w-3xl flex-col gap-6">
	<h1 class="text-3xl font-bold text-ink-900">{t('cabinet.events.title')}</h1>
	<nav aria-label={t('cabinet.events.tabs')} class="flex gap-1">
		<a class={tab} href={href('/cabinet/events')} aria-current={past ? undefined : 'page'}>
			{t('cabinet.events.upcoming')}
		</a>
		<a class={tab} href={href('/cabinet/events?tab=past')} aria-current={past ? 'page' : undefined}>
			{t('cabinet.events.past')}
		</a>
	</nav>
	{#if form?.notice}
		<p
			role={form.notice.error ? 'alert' : 'status'}
			class="rounded-md p-3 text-sm {form.notice.error
				? 'bg-error-bg text-error-fg'
				: 'bg-info-bg text-info-fg'}"
		>
			{t(form.notice.message)}
		</p>
	{/if}
	{#if rows.length === 0}
		<p class="text-ink-700">
			{t(past ? 'cabinet.events.emptyPast' : 'cabinet.events.emptyUpcoming')}
			<a class="font-bold text-navy-700 underline hover:no-underline" href={href('/events')}>
				{t('cabinet.events.browse')}
			</a>
		</p>
	{:else}
		<ul class="divide-y divide-line rounded-md border border-line bg-surface">
			{#each rows as event (event.eventId)}
				<OwnEventItem {event} {past} />
			{/each}
		</ul>
	{/if}
</div>
