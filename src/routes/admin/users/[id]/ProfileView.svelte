<script lang="ts">
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { MessageKey } from '#lib/i18n/translate.ts';
	import type { UserCard } from '#lib/server/services/users/card.ts';

	/* Read-only profile for the moderator: only fields the server sent (docs/04 section 4). */
	let { card }: { card: UserCard } = $props();
	const rows = $derived(
		(
			[
				['auth.firstName', card.firstName],
				['auth.lastName', card.lastName],
				['users.age', card.age],
				['users.col.level', card.level ? t(`level.${card.level}`) : null],
				['users.col.points', card.pointsBalance],
				['users.filter.city', card.city],
				['auth.guardianName', card.guardianName],
				['auth.guardianPhone', card.guardianPhone],
				['auth.guardianEmail', card.guardianEmail]
			] as [MessageKey, string | number | null][]
		).filter(([, value]) => value !== null && value !== '')
	);
</script>

<FormSection title={t('users.section.main')}>
	<dl class="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
		{#each rows as [label, value] (label)}
			<dt class="text-ink-500">{t(label)}</dt>
			<dd class="text-ink-900">{value}</dd>
		{/each}
	</dl>
</FormSection>
