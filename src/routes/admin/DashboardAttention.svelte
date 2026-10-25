<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { AttentionItem } from '#lib/server/services/dashboard/index.ts';
	import DashboardCard from './DashboardCard.svelte';

	/* docs/05 section 3 "Needs action": counters with links; only those the role may open. */
	let { items }: { items: AttentionItem[] } = $props();
	const waiting = $derived(items.filter((i) => i.count > 0));
</script>

<DashboardCard title={t('dashboard.attention')}>
	{#if waiting.length === 0}
		<p class="text-ink-700">{t('dashboard.attention.none')}</p>
	{/if}
	<ul class="grid gap-2 sm:grid-cols-2">
		{#each items as item (item.key)}
			<li>
				<a
					href={item.href}
					class="flex min-h-11 items-center justify-between gap-3 rounded-md border border-line px-3 py-2 hover:bg-navy-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600"
				>
					<span>{t(`dashboard.attention.${item.key}`)}</span>
					<b class={item.count > 0 ? 'text-lg text-navy-700' : 'text-lg text-ink-700'}
						>{item.count}</b
					>
				</a>
			</li>
		{/each}
	</ul>
</DashboardCard>
