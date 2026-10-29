<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import PartnerForm from '../PartnerForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const values = $derived<Record<string, string | undefined>>(
		(form && 'values' in form && form.values) || data.values
	);
</script>

<svelte:head><title>{data.partner.name} — {t('admin.title')}</title></svelte:head>

{#if form && 'saved' in form}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t('volunteer.saved')}
	</p>
{/if}
<PartnerForm
	action="?/update"
	{values}
	errors={form && 'errors' in form ? form.errors : undefined}
	images={data.images}
/>
