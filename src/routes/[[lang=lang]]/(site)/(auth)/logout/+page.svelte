<script lang="ts">
	import Button from '#lib/components/ui/Button.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
</script>

<svelte:head><title>{t('auth.logout.title')} — {t('site.name')}</title></svelte:head>

<h1 class="mb-2 text-2xl font-bold">{t('auth.logout.title')}</h1>
<p class="mb-6 text-ink-700">{t('auth.logout.text')}</p>
<form method="POST">
	<Button type="submit">{t('auth.logout.submit')}</Button>
</form>
