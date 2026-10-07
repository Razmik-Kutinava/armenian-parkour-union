<script lang="ts">
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import type { PageProps } from './$types';

	/* docs/05 section 22: one entry, "before" and "after" side by side. Read only. */
	let { data }: PageProps = $props();
	const e = $derived(data.entry);
	const show = (v: unknown) => (v == null ? '—' : JSON.stringify(v, null, 2));
	const facts = $derived([
		[t('audit.col.date'), e.createdAt.toLocaleString(currentLocale())],
		[t('audit.col.actor'), e.actorName ?? t('users.history.system')],
		[t('audit.col.entity'), [e.entityType, e.entityId].filter(Boolean).join(' · ') || '—'],
		['IP', e.ip ?? '—']
	]);
</script>

<svelte:head><title>{e.action} — {t('admin.nav.audit')}</title></svelte:head>

<a href="/admin/audit" class="text-sm font-bold text-navy-700 hover:underline"
	>← {t('admin.nav.audit')}</a
>
<h1 class="font-mono mt-2 mb-4 text-xl font-bold">{e.action}</h1>

<dl class="mb-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
	{#each facts as [label, value] (label)}
		<dt class="text-ink-500">{label}</dt>
		<dd class="break-all text-ink-900">{value}</dd>
	{/each}
</dl>

<div class="grid gap-4 md:grid-cols-2">
	{#each [['before', e.before], ['after', e.after]] as const as [key, value] (key)}
		<section aria-labelledby="audit-{key}" class="rounded-md border border-line bg-surface p-4">
			<h2 id="audit-{key}" class="mb-2 font-bold">{t(`users.history.${key}`)}</h2>
			<pre class="font-mono overflow-x-auto text-xs whitespace-pre-wrap">{show(value)}</pre>
		</section>
	{/each}
</div>
