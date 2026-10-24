<script lang="ts">
	import ContentPage from '#lib/components/site/ContentPage.svelte';
	import SeoHead from '#lib/components/site/SeoHead.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { localizePath } from '#lib/i18n/locales.ts';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<SeoHead seo={data.seo} />
<ContentPage page={data.page}>
	<a
		class="font-bold text-navy-700 underline-offset-2 hover:underline"
		href={localizePath('/federation/team', currentLocale())}>{t('team.title')} →</a
	>
</ContentPage>
