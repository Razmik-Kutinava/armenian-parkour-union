<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '#lib/components/ui/Button.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import FormMessage from '../../(auth)/FormMessage.svelte';
	import { createSubmit } from '../../(auth)/submit.svelte';

	type Props = {
		email: string;
		hasPassword: boolean;
		emailResult: { error?: MessageKey; value?: string; sentTo?: string } | undefined;
		passwordResult: { errors?: Partial<Record<string, MessageKey>>; changed?: boolean } | undefined;
		setupResult: MessageKey | undefined;
	};
	let { email, hasPassword, emailResult, passwordResult, setupResult }: Props = $props();

	const emailSending = createSubmit();
	const passwordSending = createSubmit();
	const passwordErr = (field: string) => {
		const key = passwordResult?.errors?.[field];
		return key ? t(key) : undefined;
	};
	const section = 'flex flex-col gap-4 border-t border-line pt-6';
</script>

<!-- docs/06 section 5.2: email changes only after the link sent to the new address is opened. -->
<form method="POST" action="?/email" class={section} novalidate use:enhance={emailSending.submit}>
	<h2 class="text-xl font-bold text-ink-900">{t('cabinet.email.title')}</h2>
	<p class="text-ink-700">{t('cabinet.email.current', { email })}</p>
	{#if emailResult?.sentTo}
		<FormMessage tone="success" text={t('cabinet.email.sent', { email: emailResult.sentTo })} />
	{/if}
	<Input
		label={t('cabinet.email.new')}
		name="newEmail"
		type="email"
		autocomplete="email"
		required
		hint={t('cabinet.email.hint')}
		value={emailResult?.value ?? ''}
		error={emailResult?.error ? t(emailResult.error) : undefined}
	/>
	<Button type="submit" class="w-fit" loading={emailSending.submitting}>
		{t('cabinet.email.submit')}
	</Button>
</form>

<!-- docs/04 section 6.8: a new password ends the other sessions. -->
{#if hasPassword}
	<form
		method="POST"
		action="?/password"
		class={section}
		novalidate
		use:enhance={passwordSending.submit}
	>
		<h2 class="text-xl font-bold text-ink-900">{t('cabinet.password.title')}</h2>
		{#if passwordResult?.changed}
			<FormMessage tone="success" text={t('cabinet.password.changed')} />
		{/if}
		{#if passwordErr('form')}<FormMessage tone="error" text={passwordErr('form')!} />{/if}
		<Input
			label={t('cabinet.password.current')}
			name="currentPassword"
			type="password"
			autocomplete="current-password"
			required
			error={passwordErr('currentPassword')}
		/>
		<Input
			label={t('cabinet.password.new')}
			name="newPassword"
			type="password"
			autocomplete="new-password"
			required
			hint={t('auth.passwordHint')}
			error={passwordErr('newPassword')}
		/>
		<Button type="submit" class="w-fit" loading={passwordSending.submitting}>
			{t('cabinet.password.submit')}
		</Button>
	</form>
{:else}
	<form method="POST" action="?/setupPassword" class={section} use:enhance>
		<h2 class="text-xl font-bold text-ink-900">{t('cabinet.password.title')}</h2>
		<p class="text-ink-700">{t('cabinet.password.none')}</p>
		{#if setupResult}
			<FormMessage
				tone={setupResult === 'cabinet.password.setupSent' ? 'success' : 'error'}
				text={t(setupResult)}
			/>
		{/if}
		<Button type="submit" variant="secondary" class="w-fit">{t('cabinet.password.setup')}</Button>
	</form>
{/if}
