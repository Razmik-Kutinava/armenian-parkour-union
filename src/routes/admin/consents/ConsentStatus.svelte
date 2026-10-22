<script lang="ts">
	import Badge from '#lib/components/ui/Badge.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';

	let { status }: { status: 'pending' | 'approved' | 'rejected' | 'expired' } = $props();
	const tones = {
		pending: 'info',
		approved: 'success',
		rejected: 'error',
		expired: 'warning'
	} as const;
</script>

<Badge tone={tones[status]}>{t(`consents.status.${status}`)}</Badge>
