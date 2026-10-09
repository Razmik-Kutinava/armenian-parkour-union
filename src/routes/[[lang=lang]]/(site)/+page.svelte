<script lang="ts">
	import FestAnnouncement from '#lib/components/site/FestAnnouncement.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
</script>

<svelte:head>
	<title>{t('fest.title')} · {t('site.name')}</title>
	<meta name="description" content="{t('fest.subtitle')} · {t('fest.dates')}" />
	<meta property="og:title" content={t('fest.title')} />
	<meta property="og:description" content="{t('fest.subtitle')} · {t('fest.dates')}" />
	<meta property="og:image" content="https://parkour.am/fest/yerevan-parkour-fest-2027.jpg" />
</svelte:head>

<FestAnnouncement />
