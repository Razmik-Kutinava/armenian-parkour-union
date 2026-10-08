<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import PageForm from '../PageForm.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head><title>{t('pages.create')} — {t('admin.title')}</title></svelte:head>

<a
	href="/admin/pages"
	class="mb-2 inline-block text-sm text-navy-700 underline-offset-2 hover:underline"
	>{t('pages.back')}</a
>
<h1 class="mb-6 text-2xl font-bold">{t('pages.create')}</h1>

<PageForm values={form?.values ?? {}} errors={form?.errors} />
