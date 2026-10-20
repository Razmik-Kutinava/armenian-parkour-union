<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import PurposeForm from '../PurposeForm.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head><title>{t('purposes.create')} — {t('admin.title')}</title></svelte:head>

<h1 class="mb-6 text-2xl font-bold">{t('purposes.create')}</h1>
<PurposeForm values={form?.values ?? { isActive: 'on', sortOrder: '0' }} errors={form?.errors} />
