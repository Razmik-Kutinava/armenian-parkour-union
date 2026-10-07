<script lang="ts">
	import { page } from '$app/state';
	import { currentLocale, localizePath, t } from '#lib/i18n/index.svelte.ts';
	import { errorContent } from './error-message';

	const content = $derived(errorContent(page.status, page.error?.message));
</script>

<svelte:head><title>{t(content.title)} — {t('site.name')}</title></svelte:head>

<section class="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 py-20 text-center">
	<p class="text-5xl font-bold text-accent-600" aria-hidden="true">{page.status}</p>
	<h1 class="text-3xl font-bold text-ink-900">{t(content.title)}</h1>
	<p class="text-ink-700">{'message' in content ? content.message : t(content.text)}</p>
	<a
		href={localizePath('/', currentLocale())}
		class="inline-flex min-h-11 items-center rounded-md bg-navy-700 px-5 font-bold text-surface hover:bg-navy-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600"
	>
		{t('error.home')}
	</a>
</section>
