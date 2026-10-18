<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '#lib/components/ui/Button.svelte';
	import Checkbox from '#lib/components/ui/Checkbox.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import { currentLocale, localizePath, t } from '#lib/i18n/index.svelte.ts';
	import { isMinor } from '#lib/validation/auth.ts';
	import { createSubmit } from '../submit.svelte';
	import GuardianFields from '../register/GuardianFields.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const sending = createSubmit();
	let birthDate = $derived(form?.values?.birthDate ?? '');
	const minor = $derived(isMinor(birthDate, new Date()));
	const err = (field: string) => {
		const key = form?.errors?.[field];
		return key ? t(key) : undefined;
	};
</script>

<svelte:head><title>{t('auth.profile.title')} — {t('site.name')}</title></svelte:head>

<h1 class="mb-2 text-2xl font-bold">{t('auth.profile.title')}</h1>
<p class="mb-6 text-sm text-ink-700">{t('auth.profile.text')}</p>

<form method="POST" class="flex flex-col gap-4" novalidate use:enhance={sending.submit}>
	<div class="grid gap-4 sm:grid-cols-2">
		<Input
			label={t('auth.firstName')}
			name="firstName"
			autocomplete="given-name"
			required
			value={form?.values?.firstName ?? data.draft.firstName}
			error={err('firstName')}
		/>
		<Input
			label={t('auth.lastName')}
			name="lastName"
			autocomplete="family-name"
			required
			value={form?.values?.lastName ?? data.draft.lastName}
			error={err('lastName')}
		/>
	</div>
	<Input
		label={t('auth.birthDate')}
		name="birthDate"
		type="date"
		autocomplete="bday"
		required
		bind:value={birthDate}
		error={err('birthDate')}
	/>
	{#if minor}
		<GuardianFields values={form?.values} error={err} />
	{/if}
	<Checkbox
		label={t('auth.terms')}
		name="terms"
		checked={form?.values?.terms === 'on'}
		error={err('terms')}
	/>
	<Button type="submit" loading={sending.submitting}>{t('auth.profile.submit')}</Button>
</form>

<p class="mt-6 text-sm">
	<a class="text-navy-700 underline" href={localizePath('/logout', currentLocale())}>
		{t('auth.logout.title')}
	</a>
</p>
