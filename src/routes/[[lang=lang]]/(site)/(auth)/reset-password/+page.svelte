<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '#lib/components/ui/Button.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import { currentLocale, localizePath, t } from '#lib/i18n/index.svelte.ts';
	import FormMessage from '../FormMessage.svelte';
	import { createSubmit } from '../submit.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const sending = createSubmit();
	const passwordError = $derived(form?.errors?.password ? t(form.errors.password) : undefined);
</script>

<svelte:head><title>{t('auth.reset.title')} — {t('site.name')}</title></svelte:head>

<h1 class="mb-6 text-2xl font-bold">{t('auth.reset.title')}</h1>

{#if form?.done}
	<FormMessage tone="success" text={t('auth.reset.done')} />
	<p class="mt-6 text-sm">
		<a class="text-navy-700 underline" href={localizePath('/login', currentLocale())}>
			{t('auth.login.title')}
		</a>
	</p>
{:else if !data.token}
	<FormMessage tone="error" text={t('auth.linkInvalid')} />
{:else}
	<form method="POST" class="flex flex-col gap-4" novalidate use:enhance={sending.submit}>
		{#if form?.message}<FormMessage tone="error" text={t(form.message)} />{/if}
		<input type="hidden" name="token" value={data.token} />
		<Input
			label={t('auth.newPassword')}
			name="password"
			type="password"
			autocomplete="new-password"
			required
			hint={t('auth.passwordHint')}
			error={passwordError}
		/>
		<Button type="submit" loading={sending.submitting}>{t('auth.reset.submit')}</Button>
	</form>
{/if}
