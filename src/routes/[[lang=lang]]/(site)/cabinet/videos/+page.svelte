<script lang="ts">
	import { currentLocale, localizePath, t } from '#lib/i18n/index.svelte.ts';
	import AddVideoForm from './AddVideoForm.svelte';
	import OwnVideoList from './OwnVideoList.svelte';
	import type { PageProps } from './$types';

	/* docs/06 section 5.7: the form and the history (reject reason, points, delete). */
	let { data, form }: PageProps = $props();
	const removed = $derived(form && 'removed' in form ? form.removed : null);
</script>

<svelte:head>
	<title>{t('cabinet.videos.title')} — {t('site.name')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex max-w-3xl flex-col gap-6">
	<h1 class="text-3xl font-bold text-ink-900">{t('cabinet.videos.title')}</h1>
	<p class="text-ink-700">{t('cabinet.videos.intro')}</p>
	{#if data.canAdd}
		<AddVideoForm events={data.events} settings={data.settings} result={form?.add} />
	{:else}
		<p class="rounded-md bg-info-bg p-3 text-sm text-info-fg">
			{t('cabinet.videos.needMembership')}
			<a
				class="font-bold underline hover:no-underline"
				href={localizePath('/cabinet/membership', currentLocale())}
			>
				{t('cabinet.videos.toMembership')}
			</a>
		</p>
	{/if}
	{#if removed}
		<p
			role={removed.error ? 'alert' : 'status'}
			class="rounded-md p-3 text-sm {removed.error
				? 'bg-error-bg text-error-fg'
				: 'bg-success-bg text-success-fg'}"
		>
			{t(removed.message)}
		</p>
	{/if}
	<OwnVideoList videos={data.videos} />
</div>
