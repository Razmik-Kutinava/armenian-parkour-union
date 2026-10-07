<script lang="ts">
	import { page } from '$app/state';
	import FormLayout from '#lib/components/admin/FormLayout.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import UserFields from '../UserFields.svelte';
	import AccountPanel from './AccountPanel.svelte';
	import HistoryTable from './HistoryTable.svelte';
	import ProfileView from './ProfileView.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const card = $derived(data.card);
	const created = $derived(page.url.searchParams.has('created'));
	const values = $derived(
		form && 'values' in form && form.values
			? form.values
			: {
					firstName: card.firstName,
					lastName: card.lastName,
					birthDate: card.birthDate,
					phone: card.phone,
					city: card.city,
					guardianName: card.guardianName,
					guardianPhone: card.guardianPhone,
					guardianEmail: card.guardianEmail
				}
	);
	const tabClass = (active: boolean) =>
		`inline-flex min-h-11 items-center border-b-2 px-3 font-bold ${active ? 'border-navy-700 text-navy-700' : 'border-transparent text-ink-700 hover:text-navy-700'}`;
</script>

<svelte:head><title>{card.name} — {t('admin.title')}</title></svelte:head>

<div class="mb-4 flex flex-wrap items-center gap-3">
	<h1 class="text-2xl font-bold">{card.name}</h1>
	<Badge tone="info">{t(`role.${card.role}`)}</Badge>
	<Badge tone={card.status === 'active' ? 'success' : 'error'}
		>{t(`users.status.${card.status}`)}</Badge
	>
</div>

{#if created && !form}<p
		role="status"
		class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg"
	>
		{t('users.created')}
	</p>{/if}
{#if form?.saved}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t('mailed' in form ? 'users.mailed' : 'users.saved')}
	</p>
{:else if form && 'message' in form && form.message}
	<p role="alert" class="mb-4 rounded-md bg-error-bg p-3 text-sm text-error-fg">
		{t(form.message)}
	</p>
{/if}

{#if data.can.history}
	<nav class="mb-6 flex gap-2 border-b border-line" aria-label={t('users.tabs')}>
		<a
			href="?tab=profile"
			class={tabClass(data.tab === 'profile')}
			aria-current={data.tab === 'profile' ? 'page' : undefined}>{t('users.tab.profile')}</a
		>
		<a
			href="?tab=history"
			class={tabClass(data.tab === 'history')}
			aria-current={data.tab === 'history' ? 'page' : undefined}>{t('users.tab.history')}</a
		>
	</nav>
{/if}

{#if data.tab === 'history'}
	<HistoryTable entries={data.history} />
{:else}
	<div class="flex flex-col gap-6">
		<AccountPanel {card} can={data.can} isSelf={data.isSelf} />
		{#if data.can.edit}
			<FormLayout action="?/update" cancelHref="/admin/users" novalidate>
				<UserFields {values} errors={form && 'errors' in form ? form.errors : undefined} />
			</FormLayout>
		{:else}
			<ProfileView {card} />
		{/if}
	</div>
{/if}
