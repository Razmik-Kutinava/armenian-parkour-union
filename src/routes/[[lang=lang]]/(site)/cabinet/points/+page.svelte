<script lang="ts">
	import Pagination from '#lib/components/admin/Pagination.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import PointsFilter from './PointsFilter.svelte';
	import PointsLedger from './PointsLedger.svelte';
	import type { PageProps } from './$types';

	/* docs/06 section 5.6. The shop link comes with the shop (stage 7). */
	let { data }: PageProps = $props();
	const card = 'flex flex-col gap-2 rounded-md border border-line bg-surface p-5';
	const filtered = $derived(Object.keys(data.state.filters).length > 0);
</script>

<svelte:head>
	<title>{t('cabinet.points.title')} — {t('site.name')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex max-w-4xl flex-col gap-6">
	<h1 class="text-3xl font-bold text-ink-900">{t('cabinet.points.title')}</h1>

	<div class="grid gap-4 sm:grid-cols-2">
		<section class={card} aria-labelledby="balance-title">
			<h2 id="balance-title" class="text-xl font-bold text-ink-900">
				{t('cabinet.points.balance')}
			</h2>
			<p class="text-3xl font-bold text-ink-900">{data.balance}</p>
		</section>
		<section class={card} aria-labelledby="earn-title">
			<h2 id="earn-title" class="text-xl font-bold text-ink-900">{t('cabinet.points.earn')}</h2>
			{#if data.earn.length === 0}
				<p class="text-ink-700">{t('cabinet.points.earnEmpty')}</p>
			{:else}
				<ul class="flex flex-col gap-1">
					{#each data.earn as rule (rule.code)}
						<li class="flex justify-between gap-3">
							<span class="text-ink-900">{rule.title}</span>
							<span class="font-bold whitespace-nowrap text-success-fg">+{rule.points}</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	</div>

	<section class="flex flex-col gap-4" aria-labelledby="history-title">
		<h2 id="history-title" class="text-xl font-bold text-ink-900">
			{t('cabinet.points.history')}
		</h2>
		<PointsFilter state={data.state} />
		{#if data.rows.length === 0}
			<p class="text-ink-700">
				{t(filtered ? 'cabinet.points.emptyFiltered' : 'cabinet.points.empty')}
			</p>
		{:else}
			<PointsLedger rows={data.rows} />
			<Pagination total={data.total} current={data.state.page} />
		{/if}
	</section>
</div>
