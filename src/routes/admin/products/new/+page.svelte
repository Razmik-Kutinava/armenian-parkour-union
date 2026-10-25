<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import ItemForm from '../ItemForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const values = $derived(form?.values ?? {});
</script>

<svelte:head><title>{t('shop.items.create')} — {t('admin.title')}</title></svelte:head>

<a
	href="/admin/products"
	class="mb-2 inline-block text-sm text-navy-700 underline-offset-2 hover:underline"
	>{t('shop.items.back')}</a
>
<h1 class="mb-6 text-2xl font-bold">{t('shop.items.create')}</h1>

{#key form}
	<ItemForm {values} errors={form?.errors} images={data.images} />
{/key}
