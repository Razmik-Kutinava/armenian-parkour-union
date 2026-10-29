<script lang="ts">
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import PerkForm from '../../../PerkForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const title = $derived(pickLocalized(data.perk.title, currentLocale()));
	const values = $derived<Record<string, string | undefined>>(
		(form && 'values' in form && form.values) || data.values
	);
	const perks = $derived(`/admin/volunteer/partners/${data.partner.id}/perks`);
</script>

<svelte:head><title>{title}: {data.partner.name} — {t('admin.title')}</title></svelte:head>

<a href={perks} class="mb-2 inline-block text-sm text-navy-700 underline-offset-2 hover:underline"
	>{t('volunteer.perks.back')}</a
>
<h2 class="mb-4 text-xl font-bold">{title}</h2>
{#if form && 'saved' in form}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t('volunteer.saved')}
	</p>
{/if}
<PerkForm
	action="?/update"
	cancelHref={perks}
	{values}
	errors={form && 'errors' in form ? form.errors : undefined}
/>
