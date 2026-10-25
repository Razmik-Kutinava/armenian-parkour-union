<script lang="ts">
	import Badge from '#lib/components/ui/Badge.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { OrderStatus } from '#lib/server/services/shop/order-list.ts';

	let { status }: { status: OrderStatus } = $props();
	const tones = {
		new: 'info',
		confirmed: 'neutral',
		shipped: 'warning',
		delivered: 'success',
		cancelled: 'error'
	} as const;
</script>

<Badge tone={tones[status]}>{t(`shop.order.status.${status}`)}</Badge>
