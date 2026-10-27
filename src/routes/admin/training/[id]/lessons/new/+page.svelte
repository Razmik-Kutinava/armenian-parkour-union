<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import LessonForm from '../LessonForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const values = $derived(form?.values ?? {});
	const back = $derived(`/admin/training/${data.course.id}/lessons`);
</script>

<svelte:head><title>{t('training.lesson.new')} — {t('admin.title')}</title></svelte:head>

<h2 class="mb-2 text-xl font-bold">{t('training.lesson.new')}</h2>
<p class="mb-6 text-sm text-ink-700">{t('training.lesson.pdfAfterSave')}</p>

{#key form}
	<LessonForm cancelHref={back} {values} errors={form?.errors} topics={data.topics} />
{/key}
