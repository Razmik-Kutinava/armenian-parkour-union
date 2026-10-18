<script lang="ts">
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { localizePath } from '#lib/i18n/locales.ts';

	/* docs/06 section 4.1, last block: "Join" / "Log in" for guests. */
	const href = (path: string) => localizePath(path, currentLocale());
</script>

<section class="bg-navy-950 text-surface">
	<div class="mx-auto flex max-w-page flex-col items-start gap-4 px-6 py-14 md:px-12">
		<h2 class="text-3xl font-bold">{t('home.cta.title')}</h2>
		<p class="text-lg text-navy-100">{t('home.cta.text')}</p>
		<div class="flex flex-wrap gap-3">
			<a
				href={href('/register')}
				class="inline-flex min-h-11 items-center rounded-md bg-accent-500 px-6 font-bold text-navy-950 hover:bg-accent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
				>{t('home.join')}</a
			>
			<a
				href={href('/login')}
				class="inline-flex min-h-11 items-center rounded-md border border-navy-300 px-6 font-bold text-navy-100 hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
				>{t('home.cta.login')}</a
			>
		</div>
	</div>
</section>
