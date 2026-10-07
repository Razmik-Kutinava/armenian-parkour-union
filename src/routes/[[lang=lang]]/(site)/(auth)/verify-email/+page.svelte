<script lang="ts">
	import { currentLocale, localizePath, t } from '#lib/i18n/index.svelte.ts';
	import FormMessage from '../FormMessage.svelte';
</script>

<svelte:head><title>{t('auth.verify.title')} — {t('site.name')}</title></svelte:head>

<h1 class="mb-6 text-2xl font-bold">{t('auth.verify.title')}</h1>
<FormMessage tone="success" text={t('auth.verify.done')} />
<p class="mt-6 text-sm">
	<a class="text-navy-700 underline" href={localizePath('/', currentLocale())}>{t('site.name')}</a>
</p>
