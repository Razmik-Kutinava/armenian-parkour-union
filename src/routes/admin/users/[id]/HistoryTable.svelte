<script lang="ts">
	import ScrollText from '@lucide/svelte/icons/scroll-text';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import type { HistoryEntry } from '#lib/server/services/audit.ts';

	/* docs/05 section 6, tab "History": audit entries about the user, "before" and "after" side by side. */
	let { entries }: { entries: HistoryEntry[] } = $props();
	const when = (d: Date) => d.toLocaleString(currentLocale());
	const show = (v: unknown) => (v == null ? '—' : JSON.stringify(v));
</script>

{#if entries.length === 0}
	<EmptyState icon={ScrollText} title={t('users.historyEmpty')} />
{:else}
	<div class="overflow-x-auto rounded-md border border-line bg-surface">
		<table class="w-full border-collapse text-left text-sm">
			<caption class="sr-only">{t('users.tab.history')}</caption>
			<thead class="bg-navy-50 text-ink-700">
				<tr>
					<th scope="col" class="h-11 px-3">{t('users.history.when')}</th>
					<th scope="col" class="px-3">{t('users.history.who')}</th>
					<th scope="col" class="px-3">{t('users.history.action')}</th>
					<th scope="col" class="px-3">{t('users.history.before')}</th>
					<th scope="col" class="px-3">{t('users.history.after')}</th>
				</tr>
			</thead>
			<tbody>
				{#each entries as e (e.id)}
					<tr class="border-t border-line align-top">
						<td class="px-3 py-2 whitespace-nowrap">{when(e.createdAt)}</td>
						<td class="px-3 py-2">{e.actorName ?? t('users.history.system')}</td>
						<td class="font-mono px-3 py-2 text-xs">{e.action}</td>
						<td class="font-mono px-3 py-2 text-xs break-all">{show(e.before)}</td>
						<td class="font-mono px-3 py-2 text-xs break-all">{show(e.after)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
