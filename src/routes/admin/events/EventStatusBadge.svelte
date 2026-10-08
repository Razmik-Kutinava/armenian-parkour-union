<script lang="ts">
	import Badge from '#lib/components/ui/Badge.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { EventStatus } from '#lib/validation/event-enums.ts';

	let { status }: { status: EventStatus } = $props();
	const tones = {
		draft: 'neutral',
		published: 'success',
		finished: 'info',
		cancelled: 'error',
		archived: 'warning'
	} as const;
</script>

<Badge tone={tones[status]}>{t(`events.status.${status}`)}</Badge>
