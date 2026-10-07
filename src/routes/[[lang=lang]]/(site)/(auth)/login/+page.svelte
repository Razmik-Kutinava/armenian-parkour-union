<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '#lib/components/ui/Button.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import { localizePath, currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import FormMessage from '../FormMessage.svelte';
	import { createSubmit } from '../submit.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const sending = createSubmit();
	const err = (field: string) => {
		const key = form?.errors?.[field];
		return key ? t(key) : undefined;
	};
	const path = (p: string) => localizePath(p, currentLocale());
</script>

<svelte:head><title>{t('auth.login.title')} — {t('site.name')}</title></svelte:head>

<h1 class="mb-6 text-2xl font-bold">{t('auth.login.title')}</h1>

<form method="POST" class="flex flex-col gap-4" novalidate use:enhance={sending.submit}>
	{#if form?.message}<FormMessage tone="error" text={t(form.message)} />{/if}
	<input type="hidden" name="returnTo" value={data.returnTo} />
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
		autocomplete="current-password"
		required
		error={err('password')}
	/>
	<Button type="submit" loading={sending.submitting}>{t('auth.login.submit')}</Button>
</form>

<div class="mt-6 flex flex-col gap-2 text-sm">
	<a class="text-navy-700 underline" href={path('/forgot-password')}>{t('auth.login.forgot')}</a>
	<a class="text-navy-700 underline" href={path('/register')}>{t('auth.login.noAccount')}</a>
</div>
