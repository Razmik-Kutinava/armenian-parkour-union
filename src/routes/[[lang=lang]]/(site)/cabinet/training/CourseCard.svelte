<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '#lib/components/ui/Button.svelte';
	import { currentLocale, localizePath, t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { pickPortal } from '#lib/i18n/localized.ts';
	import type { CabinetCourse } from '#lib/server/services/training/cabinet-courses.ts';

	/* docs/06 section 5.11: the state of one course; the server re-checks the conditions on apply. */
	let {
		course,
		result
	}: {
		course: CabinetCourse;
		result: { applied?: true; message?: MessageKey } | null;
	} = $props();

	const needs = $derived(
		course.missing
			.map((m) =>
				m === 'age'
					? t('cabinet.training.need.age', { age: course.minAge ?? '' })
					: m === 'level'
						? t('cabinet.training.need.level', {
								level: course.requiredLevel ? t(`level.${course.requiredLevel}`) : ''
							})
						: t('cabinet.training.need.membership')
			)
			.join('; ')
	);
	const note = (key: 'cabinet.training.rejected' | 'cabinet.training.revoked') =>
		t(key, { reason: course.reviewNote ?? '' });
</script>

<section class="flex flex-col gap-3 rounded-lg border border-line p-4">
	<h2 class="text-xl font-bold text-ink-900">{pickPortal(course.title, currentLocale())}</h2>
	{#if pickPortal(course.description, currentLocale())}
		<p class="text-ink-700">{pickPortal(course.description, currentLocale())}</p>
	{/if}

	{#if result?.applied}
		<p role="status" class="rounded-md bg-success-bg p-3 text-sm text-success-fg">
			{t('cabinet.training.applied')}
		</p>
	{:else if result?.message}
		<p role="alert" class="rounded-md bg-error-bg p-3 text-sm text-error-fg">{t(result.message)}</p>
	{/if}

	{#if course.state === 'finished'}
		<p class="font-bold text-ink-900">{t('cabinet.training.finished')}</p>
	{:else if course.state === 'approved'}
		<p class="text-ink-900">{t('cabinet.training.approved')}</p>
		<a
			class="inline-flex min-h-11 w-fit items-center rounded-md bg-navy-700 px-4 font-bold text-surface hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy-600"
			href={localizePath(`/cabinet/training/${course.slug}`, currentLocale())}
			>{t('cabinet.training.open')}</a
		>
	{:else if course.state === 'pending'}
		<p class="rounded-md bg-info-bg p-3 text-sm text-info-fg">{t('cabinet.training.pending')}</p>
	{:else if course.state === 'revoked'}
		<p class="text-ink-900">{note('cabinet.training.revoked')}</p>
	{:else if course.state === 'rejected'}
		<p class="text-ink-900">{note('cabinet.training.rejected')}</p>
	{/if}

	{#if (course.state === 'missing' || course.state === 'rejected') && course.missing.length > 0}
		<p class="rounded-md bg-info-bg p-3 text-sm text-info-fg">
			{t('cabinet.training.need', { list: needs })}
		</p>
	{/if}

	{#if course.canApply && !result?.applied}
		<form method="POST" action="?/apply" use:enhance>
			<input type="hidden" name="courseId" value={course.id} />
			<Button type="submit"
				>{t(
					course.state === 'rejected' ? 'cabinet.training.applyAgain' : 'cabinet.training.apply'
				)}</Button
			>
		</form>
	{/if}
</section>
