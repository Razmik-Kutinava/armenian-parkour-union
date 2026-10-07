<script lang="ts">
	import FormLayout from '#lib/components/admin/FormLayout.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import UserFields from '../UserFields.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<svelte:head><title>{t('users.create')} — {t('admin.title')}</title></svelte:head>

<h1 class="mb-2 text-2xl font-bold">{t('users.create')}</h1>
<p class="mb-6 text-ink-700">{t('users.createHint')}</p>

<FormLayout cancelHref="/admin/users" submitLabel={t('users.create')} novalidate>
	<UserFields values={form?.values ?? {}} errors={form?.errors} withEmail />
</FormLayout>
