<script lang="ts">
	import Button from '#lib/components/ui/Button.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { newsDate } from '#lib/components/site/news-date.ts';

	/* docs/06 section 4.12: mark without JavaScript — first click asks to confirm. */
	let {
		partnerId,
		perkId,
		remaining,
		kind,
		canMark,
		markedAt,
		confirm
	}: {
		partnerId: string;
		perkId: string;
		remaining: number | null;
		kind: 'reusable' | 'single';
		canMark: boolean;
		markedAt: Date | string | null;
		confirm: { partnerId: string; perkId: string } | null;
	} = $props();

	const asking = $derived(confirm?.partnerId === partnerId && confirm?.perkId === perkId);
</script>

{#if kind === 'single' && remaining !== null}
	<p class="text-sm text-ink-700">{t('volunteerCashier.mark.remaining', { count: remaining })}</p>
{/if}

{#if markedAt}
	<p class="text-success-700 text-sm font-bold">
		{t('volunteerCashier.mark.done', {
			time: newsDate(markedAt instanceof Date ? markedAt : new Date(markedAt), currentLocale())
		})}
	</p>
{:else if canMark}
	<form method="POST" action="?/mark" class="mt-2 flex flex-wrap gap-2">
		<input type="hidden" name="partnerId" value={partnerId} />
		<input type="hidden" name="perkId" value={perkId} />
		{#if asking}
			<input type="hidden" name="confirm" value="1" />
			<Button type="submit" variant="primary">{t('volunteerCashier.mark.confirm')}</Button>
			<a
				href="."
				class="inline-flex min-h-11 items-center px-3 text-sm font-bold text-navy-700 underline-offset-2 hover:underline sm:min-h-10"
				>{t('volunteerCashier.mark.cancel')}</a
			>
		{:else}
			<Button type="submit" variant="secondary">{t('volunteerCashier.mark.action')}</Button>
		{/if}
	</form>
{/if}
