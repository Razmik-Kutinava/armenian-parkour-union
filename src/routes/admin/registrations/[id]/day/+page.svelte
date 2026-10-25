<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '#lib/components/ui/Button.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import EventStatusBadge from '../../../events/EventStatusBadge.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 5 "Event day": for a phone — search by name, one tap "came" / "did not come". */
	let { data, form }: PageProps = $props();
	const event = $derived(data.event);
	let query = $state('');
	let busy = $state<string | null>(null);
	const shown = $derived.by(() => {
		const q = query.trim().toLocaleLowerCase();
		return q ? data.rows.filter((r) => r.name.toLocaleLowerCase().includes(q)) : data.rows;
	});
	const came = $derived(data.rows.filter((r) => r.status === 'attended').length);
	const tappable = $derived(data.canManage && data.open);
	const mark = (id: string) => () => {
		busy = id;
		return async ({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) => {
			await update({ reset: false });
			busy = null;
		};
	};
</script>

<svelte:head>
	<title>{pickLocalized(event.title, currentLocale())} — {t('registrationsAdmin.day.title')}</title>
</svelte:head>

<a
	href="/admin/registrations/{event.id}"
	class="mb-2 inline-block text-sm text-navy-700 underline-offset-2 hover:underline"
	>{t('registrationsAdmin.toTab')}</a
>
<div class="mb-1 flex flex-wrap items-center gap-3">
	<h1 class="text-2xl font-bold">{t('registrationsAdmin.day.title')}</h1>
	<EventStatusBadge status={event.status} />
</div>
<p class="mb-1 text-ink-700">{pickLocalized(event.title, currentLocale())}</p>
<p class="mb-4 text-lg font-bold" aria-live="polite">
	{t('registrationsAdmin.day.summary', { came, total: data.rows.length })}
</p>

{#if !data.open}
	<p role="status" class="mb-4 rounded-md bg-info-bg p-3 text-sm text-info-fg">
		{t('registrationsAdmin.day.closed')}
	</p>
{/if}
{#if form && 'message' in form && form.message}
	<p role="alert" class="mb-4 rounded-md bg-error-bg p-3 text-sm text-error-fg">
		{t(form.message)}
	</p>
{/if}

<div class="mb-4">
	<Input
		type="search"
		label={t('registrationsAdmin.day.search')}
		bind:value={query}
		autocomplete="off"
		class="h-12 text-lg"
	/>
</div>

{#if data.rows.length === 0}
	<p class="text-ink-700">{t('registrationsAdmin.day.empty')}</p>
{:else if shown.length === 0}
	<p class="text-ink-700">{t('registrationsAdmin.day.noMatch')}</p>
{:else}
	<ul class="flex flex-col gap-3">
		{#each shown as row (row.id)}
			<li class="rounded-md border border-line bg-surface p-3">
				<p class="text-lg font-bold">{row.name}</p>
				<p class="mb-2 text-sm text-ink-700">
					{[
						row.age ?? '—',
						row.categoryName ? pickLocalized(row.categoryName, currentLocale()) : null,
						t(`registrationsAdmin.status.${row.status}`)
					]
						.filter(Boolean)
						.join(' · ')}
				</p>
				{#if tappable}
					<form
						method="POST"
						action="?/mark"
						class="grid grid-cols-2 gap-2"
						use:enhance={mark(row.id)}
					>
						<input type="hidden" name="registrationId" value={row.id} />
						<Button
							type="submit"
							name="came"
							value="1"
							size="lg"
							variant={row.status === 'attended' ? 'primary' : 'secondary'}
							aria-pressed={row.status === 'attended'}
							disabled={busy === row.id}>{t('registrationsAdmin.day.came')}</Button
						>
						<Button
							type="submit"
							name="came"
							value="0"
							size="lg"
							variant={row.status === 'no_show' ? 'danger' : 'secondary'}
							aria-pressed={row.status === 'no_show'}
							disabled={busy === row.id}>{t('registrationsAdmin.day.noShow')}</Button
						>
					</form>
				{/if}
			</li>
		{/each}
	</ul>
{/if}

<p class="mt-6 text-sm text-ink-700">{t('registrationsAdmin.day.hint')}</p>
