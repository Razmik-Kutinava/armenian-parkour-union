<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import CourseForm from '../CourseForm.svelte';
	import { NEW_COURSE } from '../new-course';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	const values = $derived(form?.values ?? NEW_COURSE);
</script>

<svelte:head><title>{t('training.course.new')} — {t('admin.title')}</title></svelte:head>

<a
	href="/admin/training"
	class="mb-2 inline-block text-sm text-navy-700 underline-offset-2 hover:underline"
	>{t('training.course.back')}</a
>
<h1 class="mb-6 text-2xl font-bold">{t('training.course.new')}</h1>

{#key form}
	<CourseForm {values} errors={form?.errors} />
{/key}
