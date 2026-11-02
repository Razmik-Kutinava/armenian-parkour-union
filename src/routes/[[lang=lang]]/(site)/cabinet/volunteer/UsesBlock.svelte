<script lang="ts">
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import type { OwnRedemption } from '#lib/server/services/volunteer/card-own.ts';

	/* docs/06 section 5.12 "My uses": date, partner, perk; cancelled marked. */
	let { redemptions }: { redemptions: OwnRedemption[] } = $props();
</script>

<section
	aria-labelledby="volunteer-uses"
	class="flex flex-col gap-3 rounded-lg border border-line p-4"
>
	<h2 id="volunteer-uses" class="text-xl font-bold text-ink-900">
		{t('cabinet.volunteer.uses')}
	</h2>
	{#if redemptions.length === 0}
		<p class="text-ink-700">{t('cabinet.volunteer.usesEmpty')}</p>
	{:else}
		<ul class="flex flex-col gap-2">
			{#each redemptions as row (row.id)}
				<li class="text-ink-900">
					<span class="text-sm text-ink-700">{row.createdAt.toLocaleString(currentLocale())}</span>
					— {row.partnerName}: {pickLocalized(row.perkTitle, currentLocale())}
					{#if row.reversed}
						<span class="text-sm font-bold text-ink-700"
							>({t('cabinet.volunteer.usesReversed')})</span
						>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>
