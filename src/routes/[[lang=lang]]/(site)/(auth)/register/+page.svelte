<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '#lib/components/ui/Button.svelte';
	import Checkbox from '#lib/components/ui/Checkbox.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import { currentLocale, localizePath, t } from '#lib/i18n/index.svelte.ts';
	import { isMinor } from '#lib/validation/auth.ts';
	import FormMessage from '../FormMessage.svelte';
	import { createSubmit } from '../submit.svelte';
	import GuardianFields from './GuardianFields.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	const sending = createSubmit();
	let birthDate = $derived(form?.values?.birthDate ?? '');
	const minor = $derived(isMinor(birthDate, new Date()));
	const err = (field: string) => {
		const key = form?.errors?.[field];
		return key ? t(key) : undefined;
	};
</script>

<svelte:head><title>{t('auth.register.title')} — {t('site.name')}</title></svelte:head>

<h1 class="mb-6 text-2xl font-bold">{t('auth.register.title')}</h1>

<form method="POST" class="flex flex-col gap-4" novalidate use:enhance={sending.submit}>
	{#if form?.message}<FormMessage tone="error" text={t(form.message)} />{/if}
	<Input
		label={t('auth.email')}
		name="email"
		type="email"
		autocomplete="email"
		required
		value={form?.values?.email ?? ''}
		error={err('email')}
	/>
	<Input
		label={t('auth.password')}
		name="password"
		type="password"
		autocomplete="new-password"
		required
		hint={t('auth.passwordHint')}
		error={err('password')}
	/>
	<div class="grid gap-4 sm:grid-cols-2">
		<Input
			label={t('auth.firstName')}
			name="firstName"
			autocomplete="given-name"
			required
			value={form?.values?.firstName ?? ''}
			error={err('firstName')}
		/>
		<Input
			label={t('auth.lastName')}
			name="lastName"
			autocomplete="family-name"
			required
			value={form?.values?.lastName ?? ''}
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
	<Button type="submit" loading={sending.submitting}>{t('auth.register.submit')}</Button>
</form>

<p class="mt-6 text-sm">
	<a class="text-navy-700 underline" href={localizePath('/login', currentLocale())}>
		{t('auth.register.haveAccount')}
	</a>
</p>
