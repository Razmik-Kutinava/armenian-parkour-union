<script lang="ts">
	import { eventMoment } from '#lib/components/site/event-date.ts';
	import Button from '#lib/components/ui/Button.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';

	/* docs/05 section 28: the invite link is shown once — only its hash is in the database. */
	let { invite }: { invite: { label: string; link: string; expiresAt: Date } } = $props();
	let copied = $state(false);

	async function copy() {
		await navigator.clipboard.writeText(invite.link);
		copied = true;
	}
</script>

<section
	aria-labelledby="invite-title"
	class="mb-6 flex flex-col gap-3 rounded-md border border-success-fg bg-surface p-4"
>
	<h2 id="invite-title" class="font-bold text-ink-900">
		{t('volunteer.cashiers.invite.title', { label: invite.label })}
	</h2>
	<p class="text-sm text-ink-700">
		{t('volunteer.cashiers.invite.hint', { date: eventMoment(invite.expiresAt, currentLocale()) })}
	</p>
	<div class="flex flex-wrap items-end gap-3">
		<div class="min-w-64 flex-1">
			<Input label={t('volunteer.cashiers.invite.link')} value={invite.link} readonly />
		</div>
		<Button variant="secondary" onclick={copy}>{t('volunteer.cashiers.invite.copy')}</Button>
		{#if copied}<p role="status" class="text-sm text-success-fg">
				{t('volunteer.cashiers.invite.copied')}
			</p>{/if}
	</div>
</section>
