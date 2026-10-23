<script lang="ts">
	import { enhance } from '$app/forms';
	import ConfirmDialog from '#lib/components/admin/ConfirmDialog.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { controlClass } from '#lib/components/ui/control.ts';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import EventStatusBadge from '../../../events/EventStatusBadge.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 5 "Results": place and score of everyone who came, saved as one table. */
	let { data, form }: PageProps = $props();
	const event = $derived(data.event);
	let finishOpen = $state(false);
	const keep =
		() =>
		({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) =>
			update({ reset: false });
</script>

<svelte:head>
	<title
		>{pickLocalized(event.title, currentLocale())} — {t('registrationsAdmin.results.title')}</title
	>
</svelte:head>

<a
	href="/admin/registrations/{event.id}"
	class="mb-2 inline-block text-sm text-navy-700 underline-offset-2 hover:underline"
	>{t('registrationsAdmin.toTab')}</a
>
<div class="mb-1 flex flex-wrap items-center gap-3">
	<h1 class="text-2xl font-bold">{t('registrationsAdmin.results.title')}</h1>
	<EventStatusBadge status={event.status} />
</div>
<p class="mb-1 text-ink-700">{pickLocalized(event.title, currentLocale())}</p>
<p class="mb-4 text-sm text-ink-700">
	{t('registrationsAdmin.results.unmarked', { count: data.unmarked })}
	<a class="text-navy-700 underline" href="/admin/registrations/{event.id}/day"
		>{t('registrationsAdmin.dayLink')}</a
	>
</p>

{#if form && 'done' in form && form.done}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t(form.done)}
	</p>
{:else if form && 'message' in form && form.message}
	<p role="alert" class="mb-4 rounded-md bg-error-bg p-3 text-sm text-error-fg">
		{t(form.message)}
	</p>
{/if}

{#if data.rows.length === 0}
	<p class="text-ink-700">{t('registrationsAdmin.results.empty')}</p>
{:else}
	<form method="POST" action="?/save" use:enhance={keep}>
		<div class="overflow-x-auto rounded-md border border-line bg-surface">
			<table class="w-full text-sm">
				<caption class="sr-only">{t('registrationsAdmin.results.title')}</caption>
				<thead class="bg-navy-50 text-left text-ink-700">
					<tr>
						<th class="p-2">{t('registrationsAdmin.col.member')}</th>
						<th class="p-2">{t('registrationsAdmin.col.category')}</th>
						<th class="p-2">{t('registrationsAdmin.col.place')}</th>
						<th class="p-2">{t('registrationsAdmin.col.score')}</th>
					</tr>
				</thead>
				<tbody>
					{#each data.rows as row (row.id)}
						<tr class="border-t border-line">
							<td class="p-2 font-bold">{row.name}</td>
							<td class="p-2"
								>{row.categoryName ? pickLocalized(row.categoryName, currentLocale()) : '—'}</td
							>
							<td class="p-2">
								<input type="hidden" name="registrationId" value={row.id} />
								<input
									name="place.{row.id}"
									value={row.place ?? ''}
									inputmode="numeric"
									maxlength="3"
									disabled={!data.canManage}
									aria-label="{t('registrationsAdmin.col.place')} — {row.name}"
									class="{controlClass} w-20 px-2"
								/>
							</td>
							<td class="p-2">
								<input
									name="score.{row.id}"
									value={row.score ?? ''}
									inputmode="decimal"
									maxlength="8"
									disabled={!data.canManage}
									aria-label="{t('registrationsAdmin.col.score')} — {row.name}"
									class="{controlClass} w-28 px-2"
								/>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		{#if data.canManage}
			<Button type="submit" class="mt-4">{t('registrationsAdmin.results.save')}</Button>
		{/if}
	</form>
{/if}

<p class="mt-4 text-sm text-ink-500">{t('registrationsAdmin.results.hint')}</p>

{#if data.canFinish}
	<section class="mt-8 rounded-md border border-line bg-surface p-4">
		<Button variant="secondary" onclick={() => (finishOpen = true)}
			>{t('registrationsAdmin.finish')}</Button
		>
	</section>
	<ConfirmDialog
		bind:open={finishOpen}
		title={t('registrationsAdmin.finishTitle')}
		text={t('registrationsAdmin.finishText', { count: data.unmarked })}
		action="?/finish"
		confirmLabel={t('registrationsAdmin.finish')}
	/>
{/if}
