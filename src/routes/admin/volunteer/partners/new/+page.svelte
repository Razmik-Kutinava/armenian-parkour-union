<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import PartnerForm from '../PartnerForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head><title>{t('volunteer.partners.create')} — {t('admin.title')}</title></svelte:head>

<a
	href="/admin/volunteer/partners"
	class="mb-2 inline-block text-sm text-navy-700 underline-offset-2 hover:underline"
	>{t('volunteer.partners.back')}</a
>
<h1 class="mb-6 text-2xl font-bold">{t('volunteer.partners.create')}</h1>
<PartnerForm
	values={form?.values ?? { status: 'draft' }}
	errors={form?.errors}
	images={data.images}
/>
