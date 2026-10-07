<script lang="ts">
	import { currentLocale, localizePath, t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import type { FooterSettings } from '#lib/server/services/site-settings.ts';
	import type { SocialNetwork } from '#lib/validation/site-settings.ts';
	import LanguageSwitcher from './LanguageSwitcher.svelte';

	let { footer }: { footer: FooterSettings } = $props();

	const pages: [MessageKey, string][] = [
		['footer.about', '/federation'],
		['footer.rules', '/pages/rules'],
		['footer.privacy', '/pages/privacy']
	];
	const networkNames: Record<SocialNetwork, string> = {
		instagram: 'Instagram',
		youtube: 'YouTube',
		telegram: 'Telegram',
		facebook: 'Facebook',
		tiktok: 'TikTok'
	};
	const link =
		'rounded-sm text-navy-100 underline-offset-4 hover:text-surface hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500';
	const heading = 'mb-3 text-sm font-bold tracking-wide text-navy-300 uppercase';
</script>

<footer class="bg-navy-950 text-navy-100">
	<div class="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
		<section>
			<h2 class={heading}>{t('footer.links')}</h2>
			<ul class="flex flex-col gap-2">
				{#each pages as [key, path] (path)}
					<li><a class={link} href={localizePath(path, currentLocale())}>{t(key)}</a></li>
				{/each}
			</ul>
		</section>

		{#if footer.contacts}
			{@const c = footer.contacts}
			<section>
				<h2 class={heading}>{t('footer.contacts')}</h2>
				<ul class="flex flex-col gap-2">
					{#if c.email}<li><a class={link} href="mailto:{c.email}">{c.email}</a></li>{/if}
					{#if c.phone}<li>
							<a class={link} href="tel:{c.phone.replace(/[^\d+]/g, '')}">{c.phone}</a>
						</li>{/if}
					{#if c.address}<li>{c.address}</li>{/if}
					{#if c.mapUrl}
						<li>
							<a class={link} href={c.mapUrl} rel="noopener noreferrer" target="_blank"
								>{t('footer.map')}</a
							>
						</li>
					{/if}
				</ul>
			</section>
		{/if}

		{#if footer.socials.length}
			<section>
				<h2 class={heading}>{t('footer.socials')}</h2>
				<ul class="flex flex-col gap-2">
					{#each footer.socials as s (s.name)}
						<li>
							<a class={link} href={s.url} rel="noopener noreferrer" target="_blank"
								>{networkNames[s.name]}</a
							>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if footer.requisites}
			<section>
				<h2 class={heading}>{t('footer.requisites')}</h2>
				<p class="text-sm whitespace-pre-line">{footer.requisites}</p>
			</section>
		{/if}
	</div>

	<div
		class="mx-auto flex max-w-6xl flex-col gap-4 border-t border-navy-800 px-4 py-6 sm:flex-row sm:items-center sm:justify-between"
	>
		<p class="text-sm whitespace-pre-line">{footer.text ?? t('site.name')}</p>
		<LanguageSwitcher />
	</div>
</footer>
