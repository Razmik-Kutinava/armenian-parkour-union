<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '#lib/components/ui/Button.svelte';
	import Field from '#lib/components/ui/Field.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { controlClass } from '#lib/components/ui/control.ts';
	import { currentLocale, t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { localeNames, locales } from '#lib/i18n/locales.ts';
	import type { OwnProfile } from '#lib/server/services/cabinet/profile.ts';
	import FormMessage from '../../(auth)/FormMessage.svelte';
	import { createSubmit } from '../../(auth)/submit.svelte';
	import GuardianFields from '../../(auth)/register/GuardianFields.svelte';

	type Result = {
		errors?: Partial<Record<string, MessageKey>>;
		values?: Record<string, string>;
		saved?: boolean;
	};
	type Props = {
		profile: OwnProfile;
		countries: { code: string; name: string }[];
		result: Result | undefined;
	};
	let { profile, countries, result }: Props = $props();

	const sending = createSubmit();
	const v = (field: keyof OwnProfile & string) =>
		result?.values?.[field] ?? String(profile[field] ?? '');
	const err = (field: string) => {
		const key = result?.errors?.[field];
		return key ? t(key) : undefined;
	};
	const birth = $derived(
		profile.birthDate
			? new Date(`${profile.birthDate}T12:00:00Z`).toLocaleDateString(currentLocale(), {
					dateStyle: 'long',
					timeZone: 'UTC'
				})
			: t('cabinet.profile.birthDateMissing')
	);
	const guardianValues = $derived({
		guardianName: v('guardianName'),
		guardianPhone: v('guardianPhone'),
		guardianEmail: v('guardianEmail')
	});
</script>

<form
	method="POST"
	action="?/save"
	class="flex flex-col gap-4"
	novalidate
	use:enhance={sending.submit}
>
	<h2 class="text-xl font-bold text-ink-900">{t('cabinet.profile.main')}</h2>
	{#if result?.saved}<FormMessage tone="success" text={t('cabinet.profile.saved')} />{/if}
	<div class="grid gap-4 sm:grid-cols-2">
		<Input
			label={t('auth.firstName')}
			name="firstName"
			autocomplete="given-name"
			required
			value={v('firstName')}
			error={err('firstName')}
		/>
		<Input
			label={t('auth.lastName')}
			name="lastName"
			autocomplete="family-name"
			required
			value={v('lastName')}
			error={err('lastName')}
		/>
	</div>
	<div class="flex flex-col gap-1">
		<p class="text-sm font-bold text-ink-900">{t('cabinet.profile.birthDate')}</p>
		<p class="text-ink-900">{birth}</p>
		<p class="text-sm text-ink-700">{t('cabinet.profile.birthDateHint')}</p>
	</div>
	<div class="grid gap-4 sm:grid-cols-2">
		<Input
			label={t('cabinet.profile.phone')}
			name="phone"
			type="tel"
			autocomplete="tel"
			value={v('phone')}
			error={err('phone')}
		/>
		<Select
			label={t('cabinet.profile.country')}
			name="country"
			value={v('country') || 'AM'}
			options={countries.map((c) => ({ value: c.code, label: c.name }))}
			error={err('country')}
		/>
		<Input
			label={t('cabinet.profile.city')}
			name="city"
			autocomplete="address-level2"
			value={v('city')}
			error={err('city')}
		/>
		<Select
			label={t('cabinet.profile.locale')}
			name="locale"
			value={v('locale')}
			options={locales.map((l) => ({ value: l, label: localeNames[l] }))}
			error={err('locale')}
		/>
	</div>
	<Field label={t('cabinet.profile.bio')} error={err('bio')}>
		{#snippet control({ id, describedBy, invalid })}
			<textarea
				{id}
				name="bio"
				rows="4"
				maxlength="1000"
				aria-describedby={describedBy}
				aria-invalid={invalid || undefined}
				class="{controlClass} h-auto px-3 py-2">{v('bio')}</textarea
			>
		{/snippet}
	</Field>
	{#if profile.minor}
		<GuardianFields values={guardianValues} error={err} />
	{/if}
	<Button type="submit" class="w-fit" loading={sending.submitting}
		>{t('cabinet.profile.save')}</Button
	>
</form>
