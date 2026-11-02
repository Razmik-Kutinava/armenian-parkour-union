<script lang="ts">
	import { newsDate } from '#lib/components/site/news-date.ts';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import RequestForm from '../RequestForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const row = $derived(data.row);
	const values = $derived(
		(form && 'values' in form && form.values
			? (form.values as Record<string, string>)
			: data.formValues) as Record<string, string>
	);
	const open = $derived(row.status === 'open');
	const day = (d: Date) => newsDate(d, currentLocale());
</script>

<svelte:head
	><title>{pickLocalized(row.title, currentLocale())} — {t('admin.title')}</title></svelte:head
>

<p class="mb-4">
	<a class="text-navy-700 underline-offset-2 hover:underline" href="/admin/volunteer/requests"
		>{t('volunteer.requests.back')}</a
	>
</p>
<h1 class="mb-2 text-2xl font-bold">{pickLocalized(row.title, currentLocale())}</h1>
<p class="text-ink-600 mb-6">
	{t(`volunteer.requests.status.${row.status}`)} · {row.accepted} / {row.places} · {day(
		row.respondBy
	)}
</p>

{#if form && 'message' in form && form.message}
	<p class="text-red-700 mb-4" role="alert">{t(form.message)}</p>
{/if}
{#if form && 'saved' in form && form.saved}
	<p class="text-green-800 mb-4" role="status">{t('volunteer.saved')}</p>
{/if}
{#if form && 'published' in form}
	<p class="text-green-800 mb-4" role="status">
		{t('volunteer.requests.published', { n: String(form.published) })}
	</p>
{/if}
{#if form && 'invitedMore' in form}
	<p class="text-green-800 mb-4" role="status">
		{t('volunteer.requests.invitedMore', { n: String(form.invitedMore) })}
	</p>
{/if}

{#if row.status === 'draft' || row.status === 'open'}
	<section class="mb-8 flex flex-wrap gap-3">
		{#if row.status === 'draft'}
			<form method="POST" action="?/publish">
				<button
					type="submit"
					class="btn btn-primary"
					onclick={(e) => {
						if (
							!confirm(t('volunteer.requests.publishConfirm', { n: String(data.pendingInvites) }))
						)
							e.preventDefault();
					}}>{t('volunteer.requests.publish')}</button
				>
			</form>
		{/if}
		{#if row.status === 'open'}
			<form method="POST" action="?/inviteMore">
				<button
					type="submit"
					class="btn btn-secondary"
					onclick={(e) => {
						if (
							!confirm(
								t('volunteer.requests.inviteMoreConfirm', { n: String(data.pendingInvites) })
							)
						)
							e.preventDefault();
					}}>{t('volunteer.requests.inviteMore')}</button
				>
			</form>
		{/if}
		<form method="POST" action="?/cancel">
			<button
				type="submit"
				class="btn btn-danger"
				onclick={(e) => {
					if (!confirm(t('volunteer.requests.cancelConfirm'))) e.preventDefault();
				}}>{t('volunteer.requests.cancel')}</button
			>
		</form>
	</section>
{/if}

{#if row.status === 'draft' || row.status === 'open'}
	<section class="mb-10">
		<h2 class="mb-4 text-lg font-semibold">{t('volunteer.requests.edit')}</h2>
		<RequestForm {values} {open} action="?/update" />
	</section>
{/if}

<section>
	<h2 class="mb-4 text-lg font-semibold">{t('volunteer.requests.invites')}</h2>
	{#if row.invites.length === 0}
		<p class="text-ink-600">{t('volunteer.requests.invitesEmpty')}</p>
	{:else}
		<table class="w-full text-left text-sm">
			<thead>
				<tr class="border-ink-200 border-b">
					<th class="py-2 pr-3">{t('volunteer.requests.col.member')}</th>
					<th class="py-2 pr-3">{t('volunteer.requests.col.answer')}</th>
					<th class="py-2">{t('volunteer.requests.col.answeredAt')}</th>
				</tr>
			</thead>
			<tbody>
				{#each row.invites as invite (invite.id)}
					<tr class="border-ink-100 border-b">
						<td class="py-2 pr-3">
							<a
								class="text-navy-700 underline-offset-2 hover:underline"
								href="/admin/users/{invite.userId}">{invite.name}</a
							>
							<span class="text-ink-500"> · {invite.email}</span>
						</td>
						<td class="py-2 pr-3">{t(`volunteer.requests.answer.${invite.status}`)}</td>
						<td class="py-2">{invite.answeredAt ? day(invite.answeredAt) : '—'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>
