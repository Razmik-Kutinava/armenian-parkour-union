<script lang="ts">
	import Badge from '#lib/components/ui/Badge.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { VolunteerStatus } from '#lib/validation/volunteer-enums.ts';

	let { status }: { status: VolunteerStatus } = $props();
	const tone = $derived(
		status === 'published' ? 'success' : status === 'archived' ? 'neutral' : 'warning'
	);
</script>

<Badge {tone}>{t(`volunteer.status.${status}`)}</Badge>
