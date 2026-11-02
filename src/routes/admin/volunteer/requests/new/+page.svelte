<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import RequestForm from '../RequestForm.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	const values = $derived((form?.values as Record<string, string> | undefined) ?? {});
</script>

<svelte:head><title>{t('volunteer.requests.create')} — {t('admin.title')}</title></svelte:head>

<p class="mb-4">
	<a class="text-navy-700 underline-offset-2 hover:underline" href="/admin/volunteer/requests"
		>{t('volunteer.requests.back')}</a
	>
</p>
<h1 class="mb-6 text-2xl font-bold">{t('volunteer.requests.create')}</h1>
{#if form?.message}
	<p class="text-red-700 mb-4" role="alert">{t(form.message)}</p>
{/if}
<RequestForm {values} />
