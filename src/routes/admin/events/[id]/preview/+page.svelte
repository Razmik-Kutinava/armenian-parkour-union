<script lang="ts">
	import EventArticle from '#lib/components/site/EventArticle.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head
	><title>{t('events.preview')}: {data.event.title} — {t('admin.title')}</title></svelte:head
>

<p role="status" class="rounded-md bg-warning-bg p-3 text-sm text-warning-fg">
	{t('events.previewBanner')}
	<a class="ml-2 font-bold underline" href="/admin/events/{data.event.id}">{t('events.back')}</a>
</p>
<EventArticle event={data.event} shareUrl={data.shareUrl} />
