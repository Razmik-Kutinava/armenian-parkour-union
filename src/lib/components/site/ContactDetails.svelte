<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { FooterSettings } from '#lib/server/services/site-settings.ts';
	import { networkNames } from './social-names';

	/* Contacts and socials from site_settings (docs/05 section 21), the same values as the footer. */
	let { footer }: { footer: Pick<FooterSettings, 'contacts' | 'socials'> } = $props();
	const c = $derived(footer.contacts);
	const link = 'text-navy-700 underline underline-offset-2 hover:text-navy-800';
</script>

{#if c || footer.socials.length}
	<section class="flex flex-col gap-3 rounded-md border border-line bg-surface p-5">
		<ul class="flex flex-col gap-2">
			{#if c?.email}<li><a class={link} href="mailto:{c.email}">{c.email}</a></li>{/if}
			{#if c?.phone}
				<li><a class={link} href="tel:{c.phone.replace(/[^\d+]/g, '')}">{c.phone}</a></li>
			{/if}
			{#if c?.address}<li>{c.address}</li>{/if}
			{#if c?.mapUrl}
				<li>
					<a class={link} href={c.mapUrl} rel="noopener noreferrer" target="_blank"
						>{t('footer.map')}</a
					>
				</li>
			{/if}
		</ul>
		{#if footer.socials.length}
			<ul class="flex flex-wrap gap-4">
				{#each footer.socials as s (s.name)}
					<li>
						<a class={link} href={s.url} rel="noopener noreferrer" target="_blank"
							>{networkNames[s.name]}</a
						>
					</li>
				{/each}
			</ul>
		{/if}
	</section>
{/if}
