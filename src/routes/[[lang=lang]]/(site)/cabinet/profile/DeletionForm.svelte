<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '#lib/components/ui/Button.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import FormMessage from '../../(auth)/FormMessage.svelte';

	/* docs/06 section 5.2: the member only asks; an admin deletes the account (soft) or declines. */
	type Props = { requestedAt: Date | null; cancelled: boolean };
	let { requestedAt, cancelled }: Props = $props();

	const date = (d: Date) => d.toLocaleDateString(currentLocale());
</script>

<section class="flex flex-col gap-4 border-t border-line pt-6" aria-labelledby="deletion-title">
	<h2 id="deletion-title" class="text-xl font-bold text-ink-900">{t('cabinet.deletion.title')}</h2>
	<p class="text-ink-700">{t('cabinet.deletion.hint')}</p>
	{#if requestedAt}
		<FormMessage
			tone="success"
			text={t('cabinet.deletion.requested', { date: date(requestedAt) })}
		/>
		<form method="POST" action="?/deletionCancel" use:enhance>
			<Button type="submit" variant="secondary">{t('cabinet.deletion.cancel')}</Button>
		</form>
	{:else}
		{#if cancelled}<FormMessage tone="success" text={t('cabinet.deletion.cancelled')} />{/if}
		<form
			method="POST"
			action="?/deletionRequest"
			use:enhance={({ cancel }) => {
				if (!confirm(t('cabinet.deletion.confirm'))) cancel();
			}}
		>
			<Button type="submit" variant="danger">{t('cabinet.deletion.request')}</Button>
		</form>
	{/if}
</section>
