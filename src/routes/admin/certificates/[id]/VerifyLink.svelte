<script lang="ts">
	import Button from '#lib/components/ui/Button.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';

	/* docs/05 section 8 "copy the verify link": the address of the QR code, read-only. */
	let { url }: { url: string } = $props();
	let copied = $state(false);

	async function copy() {
		await navigator.clipboard.writeText(url);
		copied = true;
	}
</script>

<div class="flex flex-wrap items-end gap-3">
	<div class="min-w-64 flex-1">
		<Input label={t('certificates.card.verify')} value={url} readonly />
	</div>
	<Button variant="secondary" onclick={copy}>{t('certificates.card.copy')}</Button>
	{#if copied}<p role="status" class="text-sm text-success-fg">
			{t('certificates.card.copied')}
		</p>{/if}
</div>
