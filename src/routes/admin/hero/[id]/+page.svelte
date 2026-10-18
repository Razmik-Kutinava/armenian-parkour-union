<script lang="ts">
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import HeroForm from '../HeroForm.svelte';
	import HeroNotice from '../HeroNotice.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 4: save, preview, duplicate, archive / restore. */
	let { data, form }: PageProps = $props();
	const block = $derived(data.block);
	const values = $derived((form && 'values' in form && form.values) || data.values);
	const errors = $derived(form && 'errors' in form ? form.errors : undefined);
	const title = $derived(pickLocalized(block.title, currentLocale()));
</script>

<svelte:head><title>{title} — {t('admin.title')}</title></svelte:head>

<a
	href="/admin/hero"
	class="mb-2 inline-block text-sm text-navy-700 underline-offset-2 hover:underline"
	>{t('hero.back')}</a
>
<div class="mb-4 flex flex-wrap items-center gap-3">
	<h1 class="text-2xl font-bold">{title}</h1>
	{#if block.archived}<Badge tone="neutral">{t('hero.archived')}</Badge>{/if}
	<a class="text-sm text-navy-700 underline" href="/admin/hero/{block.id}/preview" target="_blank"
		>{t('hero.preview')}</a
	>
</div>

<div class="mb-6 flex flex-wrap gap-2">
	{#snippet button(action: string, label: string)}
		<form method="POST" action="?/{action}">
			<Button type="submit" variant="secondary" size="sm">{label}</Button>
		</form>
	{/snippet}
	{@render button('duplicate', t('hero.duplicate'))}
	{#if block.archived}{@render button('restore', t('hero.restore'))}
	{:else}{@render button('archive', t('hero.archive'))}{/if}
</div>

<HeroNotice {form} max={data.max} />

{#key data.values}
	<HeroForm
		action="?/update"
		{values}
		{errors}
		images={data.images}
		events={data.events}
		personName={data.personName}
	/>
{/key}
