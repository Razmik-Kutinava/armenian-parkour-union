<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import TaskForm from '../TaskForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const values = $derived(form?.values ?? {});
	const back = $derived(`/admin/training/${data.course.id}/tasks`);
</script>

<svelte:head><title>{t('training.task.new')} — {t('admin.title')}</title></svelte:head>

<h2 class="mb-6 text-xl font-bold">{t('training.task.new')}</h2>

{#key form}
	<TaskForm cancelHref={back} {values} errors={form?.errors} />
{/key}
