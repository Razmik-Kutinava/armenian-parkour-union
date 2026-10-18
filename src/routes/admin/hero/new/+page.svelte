<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import HeroForm from '../HeroForm.svelte';
	import HeroNotice from '../HeroNotice.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const values = $derived(form?.values ?? {});
	const errors = $derived(form && 'errors' in form ? form.errors : undefined);
</script>

<svelte:head><title>{t('hero.create')} — {t('admin.title')}</title></svelte:head>

<a
	href="/admin/hero"
	class="mb-2 inline-block text-sm text-navy-700 underline-offset-2 hover:underline"
	>{t('hero.back')}</a
>
<h1 class="mb-6 text-2xl font-bold">{t('hero.create')}</h1>

<HeroNotice {form} max={data.max} />
<HeroForm
	{values}
	{errors}
	images={data.images}
	events={data.events}
	personName={data.personName}
/>
