<script lang="ts">
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { formatPrice } from '#lib/money.ts';
	import type { Dashboard } from '#lib/server/services/dashboard/index.ts';
	import DashboardCard from './DashboardCard.svelte';

	/* docs/05 section 3, admin-only blocks; each comes as `null` without its right. */
	type Props = Pick<Dashboard, 'recentUsers' | 'suspicious' | 'stats'>;
	let { recentUsers, suspicious, stats }: Props = $props();
	const locale = $derived(currentLocale());
	const link = 'font-bold text-navy-700 underline-offset-2 hover:underline';
	const signed = (n: number) => (n > 0 ? `+${n}` : String(n));
</script>

{#if stats}
	<DashboardCard title={t('dashboard.stats')}>
		<dl class="grid grid-cols-2 gap-2">
			<dt class="text-ink-700">{t('dashboard.stats.users')}</dt>
			<dd class="text-right font-bold">{stats.users}</dd>
			<dt class="text-ink-700">{t('dashboard.stats.members')}</dt>
			<dd class="text-right font-bold">{stats.activeMembers}</dd>
		</dl>
		<h3 class="mt-3 mb-1 font-bold">{t('dashboard.stats.month')}</h3>
		{#if stats.payments.length === 0}
			<p class="text-ink-700">{t('dashboard.stats.none')}</p>
		{:else}
			<ul class="flex flex-col gap-1">
				{#each stats.payments as p (p.kind + p.currency)}
					<li class="flex justify-between gap-3">
						<span>{t(`payment.kind.${p.kind}`)} · {p.count}</span>
						<b>{formatPrice(p.amountMinor, p.currency, locale)}</b>
					</li>
				{/each}
			</ul>
		{/if}
	</DashboardCard>
{/if}

{#if suspicious}
	<DashboardCard title={t('dashboard.suspicious')}>
		<p class="mb-2">{t('dashboard.suspicious.count', { count: String(suspicious.total) })}</p>
		{#if suspicious.rows.length > 0}
			<ul class="mb-3 flex flex-col gap-1 text-sm">
				{#each suspicious.rows as row (row.id)}
					<li class="flex justify-between gap-3">
						<span
							><a class={link} href="/admin/users/{row.userId}">{row.name}</a> · {t(
								`points.reason.${row.reason}`
							)}</span
						>
						<b>{signed(row.delta)}</b>
					</li>
				{/each}
			</ul>
		{/if}
		<a class={link} href={suspicious.href}>{t('dashboard.suspicious.open')}</a>
	</DashboardCard>
{/if}

{#if recentUsers}
	<DashboardCard title={t('dashboard.recent')}>
		<ul class="flex flex-col gap-2 text-sm">
			{#each recentUsers as user (user.id)}
				<li class="flex flex-wrap justify-between gap-x-3">
					<span><a class={link} href="/admin/users/{user.id}">{user.name}</a> · {user.email}</span>
					<span class="text-ink-700">{user.createdAt.toLocaleDateString(locale)}</span>
				</li>
			{/each}
		</ul>
	</DashboardCard>
{/if}
