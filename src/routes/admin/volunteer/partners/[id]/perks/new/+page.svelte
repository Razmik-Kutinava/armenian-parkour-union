<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import PerkForm from '../../../PerkForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>{t('volunteer.perks.create')}: {data.partner.name} — {t('admin.title')}</title>
</svelte:head>

<h2 class="mb-4 text-xl font-bold">{t('volunteer.perks.create')}</h2>
<PerkForm
	cancelHref="/admin/volunteer/partners/{data.partner.id}/perks"
	values={form?.values ?? { kind: 'reusable', status: 'draft', sortOrder: '0' }}
	errors={form?.errors}
/>
