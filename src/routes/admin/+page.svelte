<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import DashboardAdmin from './DashboardAdmin.svelte';
	import DashboardAttention from './DashboardAttention.svelte';
	import DashboardEvents from './DashboardEvents.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 3: what needs attention, not statistics for its own sake. */
	let { data }: PageProps = $props();
	const d = $derived(data.dashboard);
</script>

<svelte:head><title>{t('admin.title')} — {t('site.name')}</title></svelte:head>

<h1 class="text-2xl font-bold">{t('admin.title')}</h1>
<p class="mt-2 mb-6 text-ink-700">{data.staff.name} · {t(`role.${data.staff.role}`)}</p>

<div class="grid gap-4 lg:grid-cols-2">
	{#if d.attention.length > 0}<DashboardAttention items={d.attention} />{/if}
	<DashboardEvents upcoming={d.upcoming} hero={d.hero} />
	<DashboardAdmin recentUsers={d.recentUsers} suspicious={d.suspicious} stats={d.stats} />
</div>
