<script lang="ts">
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import PostForm from '../PostForm.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 18: save, preview, publish, unpublish, archive, duplicate; delete is soft. */
	let { data, form }: PageProps = $props();
	const post = $derived(data.post);
	const values = $derived((form && 'values' in form && form.values) || data.values);
	const errors = $derived(form && 'errors' in form ? form.errors : undefined);
	const scheduled = $derived(
		post.status === 'published' && !!post.publishedAt && post.publishedAt > new Date()
	);
	const tones = { draft: 'neutral', published: 'success', archived: 'warning' } as const;
	let deleteOpen = $state(false);
</script>

<svelte:head>
	<title>{pickLocalized(post.title, currentLocale())} — {t('admin.title')}</title>
</svelte:head>

<a
	href="/admin/news"
	class="mb-2 inline-block text-sm text-navy-700 underline-offset-2 hover:underline"
	>{t('news.back')}</a
>
<div class="mb-4 flex flex-wrap items-center gap-3">
	<h1 class="text-2xl font-bold">{pickLocalized(post.title, currentLocale())}</h1>
	{#if scheduled}<Badge tone="info">{t('news.status.scheduled')}</Badge>
	{:else}<Badge tone={tones[post.status]}>{t(`pages.status.${post.status}`)}</Badge>{/if}
	<a class="text-sm text-navy-700 underline" href="/admin/news/{post.id}/preview" target="_blank"
		>{t('news.preview')}</a
	>
	{#if post.status === 'published' && !scheduled}
		<a class="text-sm text-navy-700 underline" href="/news/{post.slug}" target="_blank"
			>{t('news.open')}</a
		>
	{/if}
</div>
{#if scheduled && post.publishedAtText}
	<p class="mb-4 text-sm text-ink-700">
		{t('news.scheduledNote', { date: post.publishedAtText })}
	</p>
{/if}

<div class="mb-6 flex flex-wrap gap-2">
	{#snippet statusButton(status: string, label: string)}
		<form method="POST" action="?/status">
			<input type="hidden" name="status" value={status} />
			<Button type="submit" variant="secondary" size="sm">{label}</Button>
		</form>
	{/snippet}
	{#if post.status !== 'published'}{@render statusButton('published', t('news.publish'))}{/if}
	{#if post.status === 'published'}{@render statusButton('draft', t('news.unpublish'))}{/if}
	{#if post.status !== 'archived'}{@render statusButton('archived', t('news.archive'))}{/if}
	<form method="POST" action="?/duplicate">
		<Button type="submit" variant="ghost" size="sm">{t('news.duplicate')}</Button>
	</form>
</div>

{#if form && 'saved' in form}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t('users.saved')}
	</p>
{/if}

{#key data.values}
	<PostForm action="?/update" {values} {errors} authors={data.authors} images={data.images} />
{/key}

<div class="mt-6">
	<Button variant="danger" onclick={() => (deleteOpen = true)}>{t('news.delete')}</Button>
</div>

<ConfirmDialog
	bind:open={deleteOpen}
	title={t('news.deleteTitle')}
	text={t('news.deleteText')}
	action="?/delete"
	confirmLabel={t('news.delete')}
	danger
/>
