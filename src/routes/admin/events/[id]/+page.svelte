<script lang="ts">
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import EventForm from '../EventForm.svelte';
	import EventStatusBadge from '../EventStatusBadge.svelte';
	import EventCategories from './EventCategories.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 5: save, preview, publish / unpublish, duplicate; admin: cancel, finish, archive. */
	let { data, form }: PageProps = $props();
	const event = $derived(data.event);
	const values = $derived((form && 'values' in form && form.values) || data.values);
	const errors = $derived(form && 'errors' in form ? form.errors : undefined);
	const scheduled = $derived(
		event.status === 'published' && !!event.publishedAt && event.publishedAt > new Date()
	);
	const onSite = $derived(
		['published', 'finished', 'cancelled'].includes(event.status) &&
			!!event.publishedAt &&
			event.publishedAt <= new Date()
	);
	const formStatus = $derived(event.status === 'draft' || event.status === 'published');
	let deleteOpen = $state(false);
	let cancelOpen = $state(false);
</script>

<svelte:head>
	<title>{pickLocalized(event.title, currentLocale())} — {t('admin.title')}</title>
</svelte:head>

<a
	href="/admin/events"
	class="mb-2 inline-block text-sm text-navy-700 underline-offset-2 hover:underline"
	>{t('events.back')}</a
>
<div class="mb-4 flex flex-wrap items-center gap-3">
	<h1 class="text-2xl font-bold">{pickLocalized(event.title, currentLocale())}</h1>
	{#if scheduled}<Badge tone="info">{t('events.status.scheduled')}</Badge>
	{:else}<EventStatusBadge status={event.status} />{/if}
	<a class="text-sm text-navy-700 underline" href="/admin/events/{event.id}/preview" target="_blank"
		>{t('events.preview')}</a
	>
	{#if onSite}
		<a class="text-sm text-navy-700 underline" href="/events/{event.slug}" target="_blank"
			>{t('events.open')}</a
		>
	{/if}
</div>

<div class="mb-6 flex flex-wrap gap-2">
	{#snippet button(action: string, label: string, field?: string)}
		<form method="POST" action="?/{action}">
			{#if field}<input type="hidden" name="action" value={field} />{/if}
			<Button type="submit" variant="secondary" size="sm">{label}</Button>
		</form>
	{/snippet}
	{#if event.status === 'draft'}{@render button('status', t('events.publish'), 'publish')}{/if}
	{#if event.status === 'published'}{@render button(
			'status',
			t('events.unpublish'),
			'unpublish'
		)}{/if}
	{#if data.canCancel}
		{#if event.status === 'published' && event.started}{@render button(
				'finish',
				t('events.finish')
			)}{/if}
		{#if formStatus}
			<Button variant="secondary" size="sm" onclick={() => (cancelOpen = true)}
				>{t('events.cancel')}</Button
			>
		{/if}
		{#if event.status === 'archived'}{@render button('restore', t('events.restore'))}
		{:else}{@render button('archive', t('events.archive'))}{/if}
	{/if}
	<form method="POST" action="?/duplicate">
		<Button type="submit" variant="ghost" size="sm">{t('events.duplicate')}</Button>
	</form>
</div>

{#if form && 'saved' in form}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t('users.saved')}
	</p>
{:else if form && 'badStatus' in form}
	<p role="alert" class="mb-4 rounded-md bg-error-bg p-3 text-sm text-error-fg">
		{t('events.error.status')}
	</p>
{/if}

{#key data.values}
	<EventForm action="?/update" {values} {errors} images={data.images} statusLocked={!formStatus} />
{/key}

<div class="mt-8">
	<EventCategories
		categories={data.categories}
		failed={form && 'category' in form ? form.category : undefined}
		errors={form && 'categoryErrors' in form ? form.categoryErrors : undefined}
	/>
</div>

<div class="mt-6">
	<Button variant="danger" onclick={() => (deleteOpen = true)}>{t('events.delete')}</Button>
</div>

<ConfirmDialog
	bind:open={deleteOpen}
	title={t('events.deleteTitle')}
	text={t('events.deleteText')}
	action="?/delete"
	confirmLabel={t('events.delete')}
	danger
/>
<ConfirmDialog
	bind:open={cancelOpen}
	title={t('events.cancelTitle')}
	text={t('events.cancelText')}
	action="?/cancel"
	confirmLabel={t('events.cancel')}
	comment="required"
	danger
/>
