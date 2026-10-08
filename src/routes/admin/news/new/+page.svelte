<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import PostForm from '../PostForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const values = $derived(form?.values ?? { authorId: data.authorId });
</script>

<svelte:head><title>{t('news.create')} — {t('admin.title')}</title></svelte:head>

<a
	href="/admin/news"
	class="mb-2 inline-block text-sm text-navy-700 underline-offset-2 hover:underline"
	>{t('news.back')}</a
>
<h1 class="mb-6 text-2xl font-bold">{t('news.create')}</h1>

<PostForm {values} errors={form?.errors} authors={data.authors} images={data.images} />
