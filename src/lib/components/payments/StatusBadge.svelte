<script lang="ts">
	import Badge from '#lib/components/ui/Badge.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { PaymentStatus } from '#lib/server/services/payments/transitions.ts';

	let { status }: { status: PaymentStatus } = $props();
	const tones = {
		pending: 'info',
		paid: 'success',
		failed: 'error',
		cancelled: 'neutral',
		refunded: 'warning'
	} as const;
</script>

<Badge tone={tones[status]}>{t(`payments.status.${status}`)}</Badge>
