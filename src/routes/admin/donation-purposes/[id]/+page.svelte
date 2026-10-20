<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import { locales } from '#lib/i18n/locales.ts';
	import PurposeForm from '../PurposeForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const stored = $derived({
		...Object.fromEntries(locales.map((l) => [`title.${l}`, data.purpose.title[l] ?? ''])),
		isActive: data.purpose.isActive ? 'on' : '',
		sortOrder: String(data.purpose.sortOrder)
	});
	const values = $derived<Record<string, string | undefined>>(form?.values ?? stored);
</script>

<svelte:head><title>{data.purpose.title.en} — {t('admin.title')}</title></svelte:head>

<h1 class="mb-6 text-2xl font-bold">{data.purpose.title.en}</h1>
{#if form?.saved}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t('purposes.saved')}
	</p>
{/if}
<PurposeForm action="?/update" {values} errors={form?.errors} />
