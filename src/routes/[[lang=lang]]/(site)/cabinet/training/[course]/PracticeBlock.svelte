<script lang="ts">
	import { currentLocale, localizePath, t } from '#lib/i18n/index.svelte.ts';
	import type { PracticeStatus } from '#lib/server/services/training/practice-read.ts';

	/* docs/06 section 5.11 "Portal": the practice block at the bottom — its state and the way in. */
	let { practice, slug }: { practice: PracticeStatus; slug: string } = $props();
</script>

<section class="flex flex-col gap-3 rounded-lg border border-line p-4">
	<h2 class="text-xl font-bold text-ink-900">{t('cabinet.practice.title')}</h2>
	<p class="font-bold text-ink-900">{t(`cabinet.practice.state.${practice.state}`)}</p>
	{#if practice.total > 0 && practice.state !== 'preview'}
		<p class="text-ink-700">
			{t('cabinet.practice.progress', { accepted: practice.accepted, total: practice.total })}
		</p>
	{/if}
	<a
		class="inline-flex min-h-11 w-fit items-center rounded-md bg-navy-700 px-4 font-bold text-surface hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600"
		href={localizePath(`/cabinet/training/${slug}/practice`, currentLocale())}
		>{t('cabinet.practice.go')}</a
	>
</section>
