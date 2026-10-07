<script lang="ts">
	import Button from '#lib/components/ui/Button.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import GrantItem from './GrantItem.svelte';
	import RevokeButton from './RevokeButton.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const when = (d: Date | null) => (d ? d.toLocaleString(currentLocale()) : '—');
</script>

<svelte:head><title>{t('admin.nav.roles')} — {t('admin.title')}</title></svelte:head>

<h1 class="mb-6 text-2xl font-bold">{t('admin.nav.roles')}</h1>

{#if form?.saved}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t('users.saved')}
	</p>
{:else if form && 'message' in form && form.message}
	<p role="alert" class="mb-4 rounded-md bg-error-bg p-3 text-sm text-error-fg">
		{t(form.message)}
	</p>
{/if}

<div class="overflow-x-auto rounded-md border border-line bg-surface">
	<table class="w-full border-collapse text-left text-sm">
		<caption class="sr-only">{t('roles.staff')}</caption>
		<thead class="bg-navy-50 text-ink-700">
			<tr>
				<th scope="col" class="h-11 px-3">{t('users.col.name')}</th>
				<th scope="col" class="px-3">{t('users.col.role')}</th>
				<th scope="col" class="px-3">{t('roles.lastLogin')}</th>
				<th scope="col" class="px-3"><span class="sr-only">{t('roles.actions')}</span></th>
			</tr>
		</thead>
		<tbody>
			{#each data.staff as s (s.id)}
				<tr class="border-t border-line">
					<td class="px-3 py-2">
						<a class="font-bold text-navy-700 hover:underline" href="/admin/users/{s.id}"
							>{s.name}</a
						>
						{#if s.status === 'blocked'}<span class="text-error-fg">
								· {t('users.status.blocked')}</span
							>{/if}
					</td>
					<td class="px-3 py-2">{t(`role.${s.role}`)}</td>
					<td class="px-3 py-2 whitespace-nowrap">{when(s.lastLoginAt)}</td>
					<td class="px-3 py-2 text-right">
						{#if s.id !== data.selfId}<RevokeButton user={s} />{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>

<section class="mt-8 rounded-md border border-line bg-surface p-4 sm:p-6">
	<h2 class="text-lg font-bold">{t('roles.grantTitle')}</h2>
	<form method="GET" class="mt-4 flex flex-wrap items-end gap-3" role="search">
		<div class="min-w-48 flex-1">
			<Input label={t('roles.find')} name="q" value={data.q} />
		</div>
		<Button type="submit" variant="secondary">{t('roles.findSubmit')}</Button>
	</form>
	{#if data.q}
		{#if data.found.length === 0}
			<p class="mt-4 text-sm text-ink-700">{t('roles.notFound')}</p>
		{:else}
			<ul class="mt-4 flex flex-col gap-3">
				{#each data.found as m (m.id)}<GrantItem member={m} />{/each}
			</ul>
		{/if}
	{/if}
</section>
