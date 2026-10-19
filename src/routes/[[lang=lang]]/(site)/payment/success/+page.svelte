<script lang="ts">
	import PaymentResult from '#lib/components/site/PaymentResult.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<PaymentResult payment={data.payment} mode="success" />
