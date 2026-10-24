<script lang="ts">
	import Badge from '#lib/components/ui/Badge.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { ExamResultValue } from '#lib/validation/exam-enums.ts';

	let { result }: { result: ExamResultValue } = $props();
	const tones = {
		scheduled: 'info',
		passed: 'success',
		failed: 'error',
		cancelled: 'warning'
	} as const;
</script>

<Badge tone={tones[result]}>{t(`exams.result.${result}`)}</Badge>
