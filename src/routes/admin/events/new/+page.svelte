<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import EventForm from '../EventForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const values = $derived(form?.values ?? {});
</script>

<svelte:head><title>{t('events.create')} — {t('admin.title')}</title></svelte:head>

<a
	href="/admin/events"
	class="mb-2 inline-block text-sm text-navy-700 underline-offset-2 hover:underline"
	>{t('events.back')}</a
>
<h1 class="mb-6 text-2xl font-bold">{t('events.create')}</h1>

<EventForm {values} errors={form?.errors} images={data.images} />
