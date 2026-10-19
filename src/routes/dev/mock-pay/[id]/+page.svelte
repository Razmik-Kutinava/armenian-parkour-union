<script lang="ts">
	import Button from '#lib/components/ui/Button.svelte';
	import { formatPrice } from '#lib/money.ts';
	import type { PageProps } from './$types';

	/* Development tool, like /dev/design: English only, never in a production build. */
	let { data, form }: PageProps = $props();
	const payment = $derived(data.payment);
</script>

<svelte:head><title>Mock payment</title><meta name="robots" content="noindex" /></svelte:head>

<main class="mx-auto flex max-w-lg flex-col gap-4 p-8">
	<h1 class="text-2xl font-bold">Mock bank</h1>
	<p>
		{payment.kind} · {formatPrice(payment.amountMinor, payment.currency, 'en')} · status
		<strong>{payment.status}</strong>
	</p>
	{#if form?.result}
		<p role="status">Result: {form.result}</p>
	{/if}
	{#if payment.status === 'pending'}
		<form method="POST" action="?/settle" class="flex gap-2">
			<Button type="submit" name="status" value="paid">Pay</Button>
			<Button type="submit" name="status" value="failed" variant="secondary">Fail</Button>
			<Button type="submit" name="status" value="cancelled" variant="ghost">Cancel</Button>
		</form>
	{/if}
	<a
		class="underline"
		href="/payment/{payment.status === 'paid' ? 'success' : 'cancel'}?pid={payment.id}"
		>Return to the site</a
	>
</main>
