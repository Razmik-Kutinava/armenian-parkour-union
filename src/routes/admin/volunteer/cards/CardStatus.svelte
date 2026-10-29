<script lang="ts">
	import Badge from '#lib/components/ui/Badge.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';

	let { status }: { status: 'pending' | 'active' | 'rejected' | 'revoked' } = $props();
	const tones = {
		pending: 'info',
		active: 'success',
		rejected: 'error',
		revoked: 'warning'
	} as const;
</script>

<Badge tone={tones[status]}>{t(`volunteerCards.status.${status}`)}</Badge>
