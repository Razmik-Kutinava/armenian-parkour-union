<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import QuestionForm from '../QuestionForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const base = $derived(`/admin/training/${data.course.id}/questions`);
</script>

<svelte:head><title>{t('training.question.new')} — {t('admin.title')}</title></svelte:head>

<a href={base} class="text-sm text-navy-700 underline-offset-2 hover:underline"
	>{t('training.question.back')}</a
>
<h2 class="mb-4 text-xl font-bold">{t('training.question.new')}</h2>

<QuestionForm
	cancelHref={base}
	values={form?.values ?? { correct: '0' }}
	errors={form?.errors}
	topics={data.topics}
/>
