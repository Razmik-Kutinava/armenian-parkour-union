<script lang="ts">
	import Badge from '#lib/components/ui/Badge.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';

	let { status }: { status: 'pending' | 'approved' | 'hidden' | 'rejected' } = $props();
	const tones = {
		pending: 'info',
		approved: 'success',
		hidden: 'neutral',
		rejected: 'error'
	} as const;
</script>

<Badge tone={tones[status]}>{t(`videos.status.${status}`)}</Badge>
