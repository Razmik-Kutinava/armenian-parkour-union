<script lang="ts">
	import HeroSlider from '#lib/components/site/hero/HeroSlider.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head
	><title>{t('hero.preview')}: {data.slide.title} — {t('admin.title')}</title></svelte:head
>

<p role="status" class="mb-4 rounded-md bg-warning-bg p-3 text-sm text-warning-fg">
	{t('hero.previewBanner')}
	<a class="ml-2 font-bold underline" href="/admin/hero/{data.slide.id}">{t('hero.back')}</a>
</p>
<HeroSlider slides={[data.slide]} />
