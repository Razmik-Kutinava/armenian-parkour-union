<script lang="ts">
	import { currentLocale, localizePath, t } from '#lib/i18n/index.svelte.ts';
	import { pickPortal } from '#lib/i18n/localized.ts';
	import PreviewBanner from './PreviewBanner.svelte';
	import QuizBlock from './QuizBlock.svelte';
	import type { PageProps } from './$types';

	/* docs/06 section 5.11 "Portal": topics with their lessons in order, the quiz block at the bottom;
	 * practice — 9.7. */
	let { data }: PageProps = $props();
	const p = $derived(data.portal);
	const text = (value: Parameters<typeof pickPortal>[0]) => pickPortal(value, currentLocale());
	const href = (path: string) => localizePath(path, currentLocale());
	const link = 'font-bold text-navy-700 underline hover:no-underline';
</script>

<svelte:head>
	<title>{text(p.course.title)} — {t('site.name')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex max-w-3xl flex-col gap-6">
	<a class={link} href={href('/cabinet/training')}>{t('cabinet.training.allCourses')}</a>
	{#if p.preview}<PreviewBanner />{/if}
	<h1 class="text-3xl font-bold text-ink-900">{text(p.course.title)}</h1>
	{#if text(p.course.description)}
		<p class="text-ink-700">{text(p.course.description)}</p>
	{/if}

	{#each p.topics as topic (topic.id)}
		<section class="flex flex-col gap-3 rounded-lg border border-line p-4">
			<h2 class="text-xl font-bold text-ink-900">
				{topic.title ? text(topic.title) : t('cabinet.training.otherLessons')}
			</h2>
			<ol class="flex flex-col gap-2">
				{#each topic.lessons as lesson (lesson.id)}
					<li class="flex flex-wrap items-baseline gap-2">
						<a class={link} href={href(`/cabinet/training/${p.course.slug}/lessons/${lesson.id}`)}
							>{text(lesson.title)}</a
						>
						{#if lesson.hasFile}
							<span class="rounded bg-info-bg px-1.5 text-xs text-info-fg"
								>{t('cabinet.training.withPdf')}</span
							>
						{/if}
					</li>
				{/each}
			</ol>
		</section>
	{:else}
		<p class="text-ink-700">{t('cabinet.training.noLessons')}</p>
	{/each}

	{#if data.quiz}<QuizBlock quiz={data.quiz} slug={p.course.slug} />{/if}
</div>
