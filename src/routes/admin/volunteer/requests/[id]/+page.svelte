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
	const markable = (status: string) =>
		status === 'accepted' || status === 'attended' || status === 'no_show' || status === 'excused';
	const markKinds = ['attended', 'no_show', 'excused'] as const;
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
{#if form && 'finished' in form}
	<p class="text-green-800 mb-4" role="status">{t('volunteer.requests.finished')}</p>
{/if}
{#if form && 'marked' in form}
	<p class="text-green-800 mb-4" role="status">{t('volunteer.requests.marked')}</p>
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
			<form method="POST" action="?/finish">
				<button
					type="submit"
					class="btn btn-primary"
					onclick={(e) => {
						if (!confirm(t('volunteer.requests.finishConfirm'))) e.preventDefault();
					}}>{t('volunteer.requests.finish')}</button
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
					<th class="py-2 pr-3">{t('volunteer.requests.col.answeredAt')}</th>
					{#if data.canMark}<th class="py-2">{t('volunteer.requests.col.mark')}</th>{/if}
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
						<td class="py-2 pr-3">{invite.answeredAt ? day(invite.answeredAt) : '—'}</td>
						{#if data.canMark}
							<td class="py-2">
								{#if markable(invite.status)}
									<div class="flex flex-wrap gap-2">
										{#each markKinds as kind (kind)}
											<form method="POST" action="?/mark">
												<input type="hidden" name="invitationId" value={invite.id} />
												<input type="hidden" name="kind" value={kind} />
												<button
													type="submit"
													class="btn btn-secondary text-xs"
													disabled={invite.status === kind}
													>{t(`volunteer.requests.mark.${kind}`)}</button
												>
											</form>
										{/each}
									</div>
								{:else}
									—
								{/if}
							</td>
						{/if}
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</section>
