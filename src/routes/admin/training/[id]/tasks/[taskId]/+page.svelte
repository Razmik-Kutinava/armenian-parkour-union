<script lang="ts">
	import Badge from '#lib/components/ui/Badge.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickPortal } from '#lib/i18n/localized.ts';
	import TaskForm from '../TaskForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const values = $derived((form && 'values' in form && form.values) || data.values);
	const errors = $derived(form && 'errors' in form ? form.errors : undefined);
	const base = $derived(`/admin/training/${data.course.id}/tasks`);
	const title = $derived(pickPortal(data.task.title, currentLocale()));
</script>

<svelte:head><title>{title} — {t('admin.title')}</title></svelte:head>

<a href={base} class="text-sm text-navy-700 underline-offset-2 hover:underline"
	>{t('training.task.back')}</a
>
<div class="mb-4 flex flex-wrap items-center gap-3">
	<h2 class="text-xl font-bold">{title}</h2>
	{#if data.task.hidden}<Badge tone="warning">{t('training.tasks.hidden')}</Badge>{/if}
</div>

{#if form && 'saved' in form}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t('users.saved')}
	</p>
{/if}

{#key data.values}
	<TaskForm action="?/update" cancelHref={base} {values} {errors} />
{/key}
