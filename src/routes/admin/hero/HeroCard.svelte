<script lang="ts">
	import ImageIcon from '@lucide/svelte/icons/image';
	import { eventMoment } from '#lib/components/site/event-date.ts';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import type { HeroRow } from '#lib/server/services/hero/list.ts';

	/* docs/05 section 4: preview, title, type, switch, period; the arrows post the whole order. */
	type Props = { row: HeroRow & { mediaUrl: string | null }; up?: string; down?: string };
	let { row, up, down }: Props = $props();
	const locale = $derived(currentLocale());
	const period = $derived.by(() => {
		const parts = [
			row.startsAt && t('hero.periodFrom', { date: eventMoment(row.startsAt, locale) }),
			row.endsAt && t('hero.periodUntil', { date: eventMoment(row.endsAt, locale) })
		].filter(Boolean);
		return parts.length ? parts.join(' ') : t('hero.periodAlways');
	});
</script>

{#snippet move(order: string, label: string)}
	<form method="POST" action="?/reorder">
		<input type="hidden" name="order" value={order} />
		<Button type="submit" variant="ghost" size="sm">{label}</Button>
	</form>
{/snippet}

<div class="flex flex-wrap items-center gap-4 rounded-lg border border-line bg-surface p-3">
	<div
		class="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-md bg-navy-100"
	>
		{#if row.mediaUrl}
			<img src={row.mediaUrl} alt="" loading="lazy" class="size-full object-cover" />
		{:else}
			<ImageIcon class="size-6 text-navy-700" aria-hidden="true" />
		{/if}
	</div>
	<div class="flex min-w-0 flex-1 flex-col gap-1">
		<a class="truncate font-bold text-navy-700 hover:underline" href="/admin/hero/{row.id}"
			>{pickLocalized(row.title, locale)}</a
		>
		<div class="flex flex-wrap items-center gap-2 text-sm text-ink-700">
			<Badge>{t(`hero.type.${row.type}`)}</Badge>
			{#if row.archivedAt}<Badge>{t('hero.archived')}</Badge>
			{:else if row.isActive}<Badge tone="success">{t('hero.active.yes')}</Badge>
			{:else}<Badge>{t('hero.active.no')}</Badge>{/if}
			{#if row.onHome}<Badge tone="info">{t('hero.onHome')}</Badge>{/if}
			<span>{period}</span>
		</div>
	</div>
	{#if !row.archivedAt}
		<div class="flex flex-wrap items-center gap-1">
			{#if up}{@render move(up, t('hero.moveUp'))}{/if}
			{#if down}{@render move(down, t('hero.moveDown'))}{/if}
			<form method="POST" action="?/toggle">
				<input type="hidden" name="id" value={row.id} />
				<input type="hidden" name="active" value={String(!row.isActive)} />
				<Button type="submit" variant="secondary" size="sm"
					>{row.isActive ? t('hero.switchOff') : t('hero.switchOn')}</Button
				>
			</form>
		</div>
	{/if}
</div>
