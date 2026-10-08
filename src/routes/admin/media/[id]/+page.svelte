<script lang="ts">
	import FileText from '@lucide/svelte/icons/file-text';
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import LocalizedInput from '#lib/components/admin/LocalizedInput.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { showToast } from '#lib/components/ui/toast.svelte.ts';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { flattenValues } from '#lib/validation/site-settings-form.ts';
	import { formatSize } from '../format';
	import type { PageProps } from './$types';

	/* docs/05 section 20: alt, copy link, where the file is used; a used file cannot be deleted. */
	let { data, form }: PageProps = $props();
	const file = $derived(data.file);
	const values = $derived(flattenValues({ alt: file.alt ?? {} }));
	const errors = $derived(
		Object.fromEntries(
			Object.entries((form && 'errors' in form && form.errors) || {}).map(([k, v]) => [
				k,
				v && t(v)
			])
		)
	);
	const inUse = $derived(data.usages.length > 0);
	let deleteOpen = $state(false);

	async function copy(url: string) {
		await navigator.clipboard.writeText(url);
		showToast('success', t('media.copied'));
	}
</script>

<svelte:head><title>{file.originalName} — {t('admin.title')}</title></svelte:head>

<a
	href="/admin/media"
	class="mb-2 inline-block text-sm text-navy-700 underline-offset-2 hover:underline"
	>{t('media.back')}</a
>
<h1 class="mb-6 text-2xl font-bold break-all">{file.originalName}</h1>

{#if form && 'saved' in form}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t('users.saved')}
	</p>
{:else if form && 'inUse' in form}
	<p role="alert" class="mb-4 rounded-md bg-error-bg p-3 text-sm text-error-fg">
		{t('media.inUse')}
	</p>
{/if}

<div class="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
	<div
		class="flex aspect-square items-center justify-center overflow-hidden rounded-md bg-navy-100"
	>
		{#if file.url && file.mime.startsWith('image/')}
			<img src={file.url} alt={file.alt?.en ?? ''} class="size-full object-contain" />
		{:else}
			<FileText class="size-16 text-navy-700" aria-hidden="true" />
		{/if}
	</div>

	<div class="flex flex-col gap-6">
		<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
			<dt class="font-bold">{t('media.type')}</dt>
			<dd>{file.mime}</dd>
			<dt class="font-bold">{t('media.size')}</dt>
			<dd>{formatSize(file.sizeBytes)}</dd>
			<dt class="font-bold">{t('media.uploaded')}</dt>
			<dd>{file.createdAt.toLocaleDateString(currentLocale())}</dd>
			<dt class="font-bold">{t('media.link')}</dt>
			<dd>
				{#if file.url}
					<Button size="sm" variant="secondary" onclick={() => copy(file.url!)}
						>{t('media.copy')}</Button
					>
				{:else}
					<span class="text-ink-700">{t('media.noLink')}</span>
				{/if}
			</dd>
		</dl>

		{#if file.mime.startsWith('image/')}
			<form method="POST" action="?/alt" class="flex flex-col gap-3">
				<FormSection title={t('media.alt')} text={t('media.altHint')}>
					<LocalizedInput name="alt" label={t('media.alt')} {values} {errors} />
				</FormSection>
				<div><Button type="submit">{t('form.save')}</Button></div>
			</form>
		{/if}

		<FormSection title={t('media.usage.title')}>
			{#if inUse}
				<ul class="flex flex-col gap-1 text-sm">
					{#each data.usages as usage (usage.kind + usage.id)}
						<li>
							{#if usage.kind === 'page'}
								<a class="text-navy-700 underline" href="/admin/pages/{usage.id}"
									>{t('media.usage.page')}</a
								>
							{:else if usage.kind === 'post'}
								<a class="text-navy-700 underline" href="/admin/news/{usage.id}"
									>{t('media.usage.post')}</a
								>
							{:else if usage.kind === 'event'}
								<a class="text-navy-700 underline" href="/admin/events/{usage.id}"
									>{t('media.usage.event')}</a
								>
							{:else if data.canOpenUsers}
								<a class="text-navy-700 underline" href="/admin/users/{usage.id}"
									>{t(`media.usage.${usage.kind}`)}</a
								>
							{:else}{t(`media.usage.${usage.kind}`)}{/if}
						</li>
					{/each}
				</ul>
			{:else}
				<p class="text-sm text-ink-700">{t('media.usage.none')}</p>
			{/if}
		</FormSection>

		<div class="flex flex-col gap-2">
			<div>
				<Button variant="danger" disabled={inUse} onclick={() => (deleteOpen = true)}>
					{t('media.delete')}
				</Button>
			</div>
			{#if inUse}<p class="text-sm text-ink-700">{t('media.inUse')}</p>{/if}
		</div>
	</div>
</div>

<ConfirmDialog
	bind:open={deleteOpen}
	title={t('media.deleteTitle')}
	text={t('media.deleteText')}
	action="?/delete"
	confirmLabel={t('media.delete')}
	danger
/>
