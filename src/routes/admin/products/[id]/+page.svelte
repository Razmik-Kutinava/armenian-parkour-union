<script lang="ts">
	import Button from '#lib/components/ui/Button.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import ItemForm from '../ItemForm.svelte';
	import ItemStatusBadge from '../ItemStatusBadge.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 14: save, publish / hide, archive / restore, duplicate. */
	let { data, form }: PageProps = $props();
	const item = $derived(data.item);
	const values = $derived((form && 'values' in form && form.values) || data.values);
	const errors = $derived(form && 'errors' in form ? form.errors : undefined);
	const title = $derived(pickLocalized(item.title, currentLocale()));
</script>

<svelte:head><title>{title} — {t('admin.title')}</title></svelte:head>

<a
	href="/admin/products"
	class="mb-2 inline-block text-sm text-navy-700 underline-offset-2 hover:underline"
	>{t('shop.items.back')}</a
>
<div class="mb-4 flex flex-wrap items-center gap-3">
	<h1 class="text-2xl font-bold">{title}</h1>
	<ItemStatusBadge status={item.status} />
</div>

<div class="mb-6 flex flex-wrap gap-2">
	{#snippet button(action: string, label: string)}
		<form method="POST" action="?/status">
			<input type="hidden" name="action" value={action} />
			<Button type="submit" variant="secondary" size="sm">{label}</Button>
		</form>
	{/snippet}
	{#if item.status === 'draft'}{@render button('publish', t('shop.item.publish'))}{/if}
	{#if item.status === 'published'}{@render button('unpublish', t('shop.item.unpublish'))}{/if}
	{#if item.status === 'archived'}{@render button('restore', t('shop.item.restore'))}
	{:else}{@render button('archive', t('shop.item.archive'))}{/if}
	<form method="POST" action="?/duplicate">
		<Button type="submit" variant="ghost" size="sm">{t('shop.item.duplicate')}</Button>
	</form>
</div>

{#if form && 'saved' in form}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t('users.saved')}
	</p>
{:else if form && 'badStatus' in form}
	<p role="alert" class="mb-4 rounded-md bg-error-bg p-3 text-sm text-error-fg">
		{t('shop.error.status')}
	</p>
{/if}

{#key data.values}
	<ItemForm
		action="?/update"
		{values}
		{errors}
		images={data.images}
		statusLocked={item.status === 'archived'}
	/>
{/key}
