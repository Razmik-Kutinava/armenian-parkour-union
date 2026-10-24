<script lang="ts">
	import { enhance, type SubmitFunction } from '$app/forms';
	import Button from '#lib/components/ui/Button.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import FormMessage from '../../(auth)/FormMessage.svelte';

	type Props = {
		events: { value: string; label: string }[];
		settings: { monthlyLimit: number; platforms: string[] };
		result:
			| {
					added?: boolean;
					errors?: Partial<Record<string, MessageKey>>;
					values?: Record<string, string>;
			  }
			| undefined;
	};
	let { events, settings, result }: Props = $props();

	const NAMES: Record<string, string> = { youtube: 'YouTube', instagram: 'Instagram' };
	const limit = $derived(settings.monthlyLimit);
	const err = (field: string) => {
		const key = result?.errors?.[field];
		return key ? t(key, { limit }) : undefined;
	};
	const value = (field: string) => result?.values?.[field] ?? '';

	let submitting = $state(false);
	const submit: SubmitFunction = () => {
		submitting = true;
		return async ({ result: outcome, update }) => {
			await update({ reset: outcome.type === 'success' });
			submitting = false;
		};
	};
</script>

<form
	method="POST"
	action="?/add"
	class="flex flex-col gap-4 rounded-md border border-line bg-surface p-5"
	novalidate
	use:enhance={submit}
>
	<h2 class="text-xl font-bold text-ink-900">{t('cabinet.videos.add')}</h2>
	{#if result?.added}
		<FormMessage tone="success" text={t('cabinet.videos.added')} />
	{/if}
	{#if err('form')}
		<FormMessage tone="error" text={err('form') ?? ''} />
	{/if}
	<Input
		label={t('cabinet.videos.url')}
		name="url"
		type="url"
		inputmode="url"
		required
		maxlength={500}
		hint={t('cabinet.videos.urlHint', {
			platforms: settings.platforms.map((p) => NAMES[p] ?? p).join(', '),
			limit
		})}
		value={value('url')}
		error={err('url')}
	/>
	<Input
		label={t('cabinet.videos.videoTitle')}
		name="title"
		required
		maxlength={120}
		value={value('title')}
		error={err('title')}
	/>
	{#if events.length > 0}
		<Select
			label={t('cabinet.videos.event')}
			name="eventId"
			options={[{ value: '', label: t('cabinet.videos.noEvent') }, ...events]}
			value={value('eventId')}
			error={err('eventId')}
		/>
	{/if}
	<Button type="submit" class="w-fit" loading={submitting}>{t('cabinet.videos.submit')}</Button>
</form>
