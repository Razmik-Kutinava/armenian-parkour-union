<script lang="ts">
	import Badge from '#lib/components/ui/Badge.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';

	let { status }: { status: 'draft' | 'published' | 'archived' } = $props();
	const tones = { draft: 'neutral', published: 'success', archived: 'warning' } as const;
</script>

<Badge tone={tones[status]}>{t(`training.status.${status}`)}</Badge>
