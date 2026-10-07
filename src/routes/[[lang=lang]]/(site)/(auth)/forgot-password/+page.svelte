<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '#lib/components/ui/Button.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import FormMessage from '../FormMessage.svelte';
	import { createSubmit } from '../submit.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
	const sending = createSubmit();
	const emailError = $derived(form?.errors?.email ? t(form.errors.email) : undefined);
</script>

<svelte:head><title>{t('auth.forgot.title')} — {t('site.name')}</title></svelte:head>

<h1 class="mb-2 text-2xl font-bold">{t('auth.forgot.title')}</h1>

{#if form?.sent}
	<FormMessage tone="success" text={t('auth.forgot.sent')} />
{:else}
	<p class="mb-6 text-ink-700">{t('auth.forgot.text')}</p>
	<form method="POST" class="flex flex-col gap-4" novalidate use:enhance={sending.submit}>
		{#if form?.message}<FormMessage tone="error" text={t(form.message)} />{/if}
		<Input
			label={t('auth.email')}
			name="email"
			type="email"
			autocomplete="email"
			required
			value={form?.values?.email ?? ''}
			error={emailError}
		/>
		<Button type="submit" loading={sending.submitting}>{t('auth.forgot.submit')}</Button>
	</form>
{/if}
