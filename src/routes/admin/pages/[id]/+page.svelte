<script lang="ts">
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import PageForm from '../PageForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const page = $derived(data.page);
	const values = $derived((form && 'values' in form && form.values) || data.values);
	const errors = $derived(form && 'errors' in form ? form.errors : undefined);
	let deleteOpen = $state(false);
</script>

<svelte:head>
	<title>{pickLocalized(page.title, currentLocale())} — {t('admin.title')}</title>
</svelte:head>

<a
	href="/admin/pages"
	class="mb-2 inline-block text-sm text-navy-700 underline-offset-2 hover:underline"
	>{t('pages.back')}</a
>
<div class="mb-6 flex flex-wrap items-center gap-3">
	<h1 class="text-2xl font-bold">{pickLocalized(page.title, currentLocale())}</h1>
	{#if page.isSystem}<Badge tone="info">{t('pages.system')}</Badge>{/if}
	{#if page.status === 'published'}
		<a class="text-sm text-navy-700 underline" href={data.publicPath} target="_blank"
			>{t('pages.open')}</a
		>
	{/if}
</div>

{#if form && 'saved' in form}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t('users.saved')}
	</p>
{:else if form && 'system' in form}
	<p role="alert" class="mb-4 rounded-md bg-error-bg p-3 text-sm text-error-fg">
		{t('pages.systemNoDelete')}
	</p>
{/if}

{#key data.values}
	<PageForm action="?/update" {values} {errors} isSystem={page.isSystem} />
{/key}

<div class="mt-6">
	{#if page.isSystem}
		<p class="text-sm text-ink-700">{t('pages.systemNoDelete')}</p>
	{:else}
		<Button variant="danger" onclick={() => (deleteOpen = true)}>{t('pages.delete')}</Button>
	{/if}
</div>

<ConfirmDialog
	bind:open={deleteOpen}
	title={t('pages.deleteTitle')}
	text={t('pages.deleteText')}
	action="?/delete"
	confirmLabel={t('pages.delete')}
	danger
/>
