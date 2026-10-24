<script lang="ts">
	import { newsDate } from '#lib/components/site/news-date.ts';
	import { currentLocale, localizePath, t } from '#lib/i18n/index.svelte.ts';
	import type { MembershipLevel } from '#lib/server/auth/session.ts';
	import type { NextStep } from '#lib/server/services/cabinet/progress-next.ts';

	/* docs/06 section 5.5: novice → advanced → pro with the current one marked; the next step is
	 * what docs/03 section 3.3 allows now. Exams are scheduled by the federation. */
	let { level, next }: { level: MembershipLevel | null; next: NextStep } = $props();
	const LEVELS = ['novice', 'advanced', 'pro'] as const;
	const rank = (l: MembershipLevel | null) => (l ? LEVELS.indexOf(l) : -1);

	const message = $derived.by(() => {
		if (next.step !== 'exam') return t(`cabinet.progress.next.${next.step}`);
		const params = {
			exam: t(`exams.kind.${next.kind}`),
			date: next.availableFrom ? newsDate(next.availableFrom, currentLocale()) : ''
		};
		return t(`cabinet.progress.next.${next.refusal ?? 'ready'}`, params);
	});
	const toMembership = $derived(
		next.step === 'join' || (next.step === 'exam' && next.refusal === 'no_membership')
	);
</script>

<section
	class="flex flex-col gap-3 rounded-md border border-line bg-surface p-5"
	aria-labelledby="levels-title"
>
	<h2 id="levels-title" class="text-xl font-bold text-ink-900">{t('cabinet.progress.levels')}</h2>
	<ol class="grid grid-cols-3 gap-2" aria-labelledby="levels-title">
		{#each LEVELS as step, i (step)}
			<li
				aria-current={step === level ? 'step' : undefined}
				class="flex flex-col rounded-md border-2 p-3 {i <= rank(level)
					? 'border-navy-700 bg-navy-100 text-ink-900'
					: 'border-line text-ink-700'} aria-[current=step]:bg-navy-900 aria-[current=step]:text-surface"
			>
				<span class="font-bold">{i + 1}. {t(`level.${step}`)}</span>
				{#if step === level}<span class="text-sm">{t('cabinet.progress.current')}</span>{/if}
			</li>
		{/each}
	</ol>
	{#if !level}<p class="text-ink-700">{t('cabinet.progress.noLevel')}</p>{/if}
	<p class="text-ink-900">{message}</p>
	{#if toMembership}
		<a
			class="font-bold text-navy-700 underline hover:no-underline"
			href={localizePath('/cabinet/membership', currentLocale())}
			>{t('cabinet.progress.membership')}</a
		>
	{/if}
</section>
