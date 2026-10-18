<script lang="ts">
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import HomeSection from './HomeSection.svelte';

	/* docs/06 section 4.1: join → train → pass an exam → earn points; text from translations. */
	const steps = [1, 2, 3, 4].map((n) => ({
		title: `home.step${n}.title` as MessageKey,
		text: `home.step${n}.text` as MessageKey
	}));
</script>

<HomeSection title={t('home.how')}>
	<ol class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
		{#each steps as step, i (step.title)}
			<li class="flex flex-col gap-2 rounded-lg border border-line bg-surface p-5">
				<span
					class="flex size-10 items-center justify-center rounded-full bg-accent-500 font-bold text-navy-950"
					aria-hidden="true">{i + 1}</span
				>
				<h3 class="text-lg font-bold text-ink-900">{t(step.title)}</h3>
				<p class="text-ink-700">{t(step.text)}</p>
			</li>
		{/each}
	</ol>
</HomeSection>
