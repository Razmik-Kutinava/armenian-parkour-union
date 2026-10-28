<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import CourseCard from './CourseCard.svelte';
	import type { PageProps } from './$types';

	/* docs/06 section 5.11 "Course list": each published course with the member's state. */
	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>{t('cabinet.nav.training')} — {t('site.name')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex max-w-3xl flex-col gap-6">
	<h1 class="text-3xl font-bold text-ink-900">{t('cabinet.nav.training')}</h1>
	<p class="text-ink-700">{t('cabinet.training.intro')}</p>
	{#each data.courses as course (course.id)}
		<CourseCard {course} result={form?.courseId === course.id ? form : null} />
	{:else}
		<p class="text-ink-700">{t('cabinet.training.empty')}</p>
	{/each}
</div>
