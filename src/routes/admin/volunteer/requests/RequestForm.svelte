<script lang="ts">
	import Input from '#lib/components/ui/Input.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';

	/* docs/05 section 28 "Requests" form. Rich description uses plain textarea for MVP of 10.8. */
	type Values = Record<string, string | undefined>;
	let {
		values = {},
		open = false,
		action = ''
	}: { values?: Values; open?: boolean; action?: string } = $props();

	const field = (name: string, fallback = '') => ({
		name,
		value: values[name] ?? fallback
	});
</script>

<form method="POST" {action} class="flex max-w-xl flex-col gap-4">
	<Input label={t('volunteer.requests.titleEn')} required {...field('title.en')} />
	<Input label={t('volunteer.requests.titleHy')} {...field('title.hy')} />
	<Input label={t('volunteer.requests.titleRu')} {...field('title.ru')} />
	<label class="flex flex-col gap-1 text-sm">
		<span class="text-ink-800 font-medium">{t('volunteer.requests.descriptionEn')}</span>
		<textarea
			name="description.en"
			rows="4"
			class="rounded border-ink-200 border px-3 py-2"
			value={values['description.en'] ?? ''}></textarea>
	</label>
	{#if !open}
		<Input
			type="datetime-local"
			label={t('volunteer.requests.startsAt')}
			required
			{...field('startsAt')}
		/>
		<Input
			type="datetime-local"
			label={t('volunteer.requests.endsAt')}
			required
			{...field('endsAt')}
		/>
		<Input label={t('volunteer.requests.location')} {...field('location')} />
		<input type="hidden" name="eventId" value={values.eventId ?? ''} />
	{/if}
	<Input
		type="number"
		label={t('volunteer.requests.places')}
		required
		min="1"
		max="500"
		{...field('places', '2')}
	/>
	<Input
		type="datetime-local"
		label={t('volunteer.requests.respondBy')}
		required
		{...field('respondBy')}
	/>
	<button type="submit" class="btn btn-primary self-start">{t('volunteer.saved')}</button>
</form>
