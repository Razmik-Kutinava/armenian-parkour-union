<script lang="ts">
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import type { VisiblePartner } from '#lib/server/services/volunteer/perks-visible.ts';

	/* docs/06 section 5.12 "Perks": a valid card only (the page decides); a single perk shows what is
	 * left of it for this card. */
	let { partners }: { partners: VisiblePartner[] } = $props();
</script>

<section
	aria-labelledby="volunteer-perks"
	class="flex flex-col gap-3 rounded-lg border border-line p-4"
>
	<h2 id="volunteer-perks" class="text-xl font-bold text-ink-900">
		{t('cabinet.volunteer.perks')}
	</h2>
	{#if partners.length === 0}
		<p class="text-ink-700">{t('cabinet.volunteer.perksEmpty')}</p>
	{:else}
		<ul class="flex flex-col gap-4">
			{#each partners as partner (partner.id)}
				<li class="flex flex-col gap-1">
					<h3 class="font-bold text-ink-900">{partner.name}</h3>
					<ul class="flex flex-col gap-2 pl-4">
						{#each partner.perks as perk (perk.id)}
							<li>
								<p class="text-ink-900">{pickLocalized(perk.title, currentLocale())}</p>
								{#if perk.terms}
									<p class="text-sm text-ink-700">{pickLocalized(perk.terms, currentLocale())}</p>
								{/if}
								{#if perk.remaining !== null && perk.usesLimit !== null}
									<p class="text-sm font-bold text-ink-700">
										{t('cabinet.volunteer.left', {
											left: String(perk.remaining),
											limit: String(perk.usesLimit)
										})}
									</p>
								{/if}
							</li>
						{/each}
					</ul>
				</li>
			{/each}
		</ul>
	{/if}
</section>
