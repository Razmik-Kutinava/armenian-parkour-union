<script lang="ts">
	import { page } from '$app/state';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickPortal } from '#lib/i18n/localized.ts';
	import CourseStatusBadge from '../CourseStatusBadge.svelte';
	import type { LayoutProps } from './$types';

	/* docs/05 section 27: course card tabs; lessons — training.lessons, the rest — admin. */
	let { data, children }: LayoutProps = $props();
	const base = $derived(`/admin/training/${data.course.id}`);
	const tabs = $derived(
		[
			{ href: base, label: t('training.tab.course'), admin: true },
			{ href: `${base}/topics`, label: t('training.tab.topics'), admin: true },
			{ href: `${base}/lessons`, label: t('training.tab.lessons'), admin: false },
			{ href: `${base}/questions`, label: t('training.tab.questions'), admin: true },
			{ href: `${base}/tasks`, label: t('training.tab.tasks'), admin: true }
		].filter((tab) => data.canManage || !tab.admin)
	);
	const current = $derived(
		[...tabs].reverse().find((tab) => page.url.pathname.startsWith(tab.href))?.href
	);
	const title = $derived(pickPortal(data.course.title, currentLocale()));
</script>

<a
	href="/admin/training"
	class="mb-2 inline-block text-sm text-navy-700 underline-offset-2 hover:underline"
	>{t('training.course.back')}</a
>
<div class="mb-4 flex flex-wrap items-center gap-3">
	<h1 class="text-2xl font-bold">{title}</h1>
	<CourseStatusBadge status={data.course.status} />
</div>

<nav aria-label={t('training.tabs')} class="mb-6 flex gap-2 overflow-x-auto border-b border-line">
	{#each tabs as tab (tab.href)}
		<a
			href={tab.href}
			aria-current={tab.href === current ? 'page' : undefined}
			class="-mb-px inline-flex min-h-11 items-center border-b-2 px-3 font-bold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600 sm:min-h-10 {tab.href ===
			current
				? 'border-navy-700 text-navy-700'
				: 'border-transparent text-ink-700 hover:text-navy-700'}"
		>
			{tab.label}
		</a>
	{/each}
</nav>

{@render children()}
