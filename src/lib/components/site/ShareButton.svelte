<script lang="ts">
	import Share2 from '@lucide/svelte/icons/share-2';
	import Button from '#lib/components/ui/Button.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';

	/* Decision 2.4: the phone's share menu, otherwise copy the link; no third-party widgets. */
	let { title, url }: { title: string; url: string } = $props();
	let copied = $state(false);

	async function share() {
		if (navigator.share) {
			await navigator.share({ title, url }).catch(() => {});
			return;
		}
		await navigator.clipboard.writeText(url);
		copied = true;
	}
</script>

<div class="flex items-center gap-3">
	<Button variant="secondary" size="sm" onclick={share}>
		<Share2 class="size-4" aria-hidden="true" />{t('news.share')}
	</Button>
	<span role="status" class="text-sm text-success-fg">{copied ? t('news.copied') : ''}</span>
</div>
