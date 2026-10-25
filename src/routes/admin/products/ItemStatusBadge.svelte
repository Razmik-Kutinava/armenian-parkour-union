<script lang="ts">
	import Badge from '#lib/components/ui/Badge.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { PageStatus } from '#lib/validation/pages.ts';

	let { status }: { status: PageStatus } = $props();
	const tones = { draft: 'neutral', published: 'success', archived: 'warning' } as const;
</script>

<Badge tone={tones[status]}>{t(`shop.item.status.${status}`)}</Badge>
