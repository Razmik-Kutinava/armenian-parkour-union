<script lang="ts">
	import NewsArticle from '#lib/components/site/NewsArticle.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head><title>{t('news.preview')}: {data.post.title} — {t('admin.title')}</title></svelte:head
>

<p role="status" class="rounded-md bg-warning-bg p-3 text-sm text-warning-fg">
	{t('news.previewBanner')}
	<a class="ml-2 font-bold underline" href="/admin/news/{data.post.id}">{t('news.back')}</a>
</p>
<NewsArticle post={data.post} related={[]} shareUrl={data.shareUrl} />
