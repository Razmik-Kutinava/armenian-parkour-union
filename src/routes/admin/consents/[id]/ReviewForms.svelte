<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '#lib/components/ui/Button.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import { controlClass } from '#lib/components/ui/control.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { yerevanDay } from '#lib/validation/admin-payments.ts';

	/* docs/05 section 10: approve with an optional term, or reject with a reason the member sees. */
	const keep =
		() =>
		({ update }: { update: (o?: { reset?: boolean }) => Promise<void> }) =>
			update({ reset: false });
</script>

<section class="flex flex-col gap-4">
	<h2 class="text-lg font-bold">{t('consents.card.decision')}</h2>
	<div class="grid gap-6 md:grid-cols-2">
		<form method="POST" action="?/approve" class="flex flex-col gap-3" use:enhance={keep}>
			<Input
				type="date"
				name="validUntil"
				label={t('consents.form.validUntil')}
				hint={t('consents.form.validUntilHint')}
				min={yerevanDay(new Date())}
			/>
			<Button type="submit" class="w-fit">{t('consents.approve')}</Button>
		</form>
		<form method="POST" action="?/reject" class="flex flex-col gap-3" use:enhance={keep}>
			<Field label={t('consents.form.note')} hint={t('consents.form.noteHint')}>
				{#snippet control({ id, describedBy, invalid })}
					<textarea
						{id}
						name="note"
						required
						maxlength="500"
						rows="3"
						aria-describedby={describedBy}
						aria-invalid={invalid || undefined}
						class="{controlClass} px-3 py-2"></textarea>
				{/snippet}
			</Field>
			<Button type="submit" variant="danger" class="w-fit">{t('consents.reject')}</Button>
		</form>
	</div>
</section>
