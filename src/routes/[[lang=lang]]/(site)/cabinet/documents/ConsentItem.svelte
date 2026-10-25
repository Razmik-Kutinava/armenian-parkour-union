<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { newsDate } from '#lib/components/site/news-date.ts';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import { currentLocale, t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { yerevanDay } from '#lib/validation/admin-payments.ts';
	import { consentMimes } from '#lib/validation/consents.ts';
	import type { OwnConsent } from '#lib/server/services/consents/own.ts';
	import FormMessage from '../../(auth)/FormMessage.svelte';
	import { uploadConsent } from './upload-consent';

	/* docs/06 section 5.10: status, term, reason; a new file goes straight to the private bucket. */
	let { item }: { item: OwnConsent } = $props();

	const tones = {
		pending: 'info',
		approved: 'success',
		rejected: 'error',
		expired: 'warning'
	} as const;
	const date = (d: Date) => newsDate(d, currentLocale());
	const titleId = $derived(`consent-${item.kind}`);
	const latest = $derived(item.latest);

	let uploading = $state(false);
	let message = $state<MessageKey | null>(null);
	let signedOn = $state('');
	let fileInput = $state<HTMLInputElement>();

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		uploading = true;
		message = null;
		const error = await uploadConsent(item.kind, fileInput?.files?.[0], signedOn).catch(
			(): MessageKey => 'consents.error.failed'
		);
		uploading = false;
		message = error ?? 'consents.sent';
		if (!error) {
			if (fileInput) fileInput.value = '';
			await invalidateAll();
		}
	}
</script>

<section
	class="flex flex-col gap-3 rounded-md border border-line bg-surface p-5"
	aria-labelledby={titleId}
>
	<div class="flex flex-wrap items-center justify-between gap-2">
		<h2 id={titleId} class="text-xl font-bold text-ink-900">{t(`consents.kind.${item.kind}`)}</h2>
		{#if latest}
			<Badge tone={tones[latest.status]}>{t(`consents.status.${latest.status}`)}</Badge>
		{:else}
			<Badge>{t('consents.status.none')}</Badge>
		{/if}
	</div>
	<p class="text-sm text-ink-700">{t(`consents.kindHint.${item.kind}`)}</p>

	{#if latest}
		<ul class="flex flex-col gap-1 text-sm text-ink-900">
			{#if latest.signedAt}<li>{t('consents.signedAt', { date: date(latest.signedAt) })}</li>{/if}
			{#if latest.status === 'approved' || latest.status === 'expired'}
				<li>
					{latest.validUntil
						? t('consents.validUntil', { date: date(latest.validUntil) })
						: t('consents.noEnd')}
				</li>
			{/if}
			{#if latest.reviewNote}<li class="text-error-fg">
					{t('consents.reason', { note: latest.reviewNote })}
				</li>{/if}
			{#if item.inForce && latest.status !== 'approved'}
				<li>
					{item.inForce.validUntil
						? t('consents.inForceUntil', { date: date(item.inForce.validUntil) })
						: t('consents.inForce')}
				</li>
			{/if}
		</ul>
		{#if latest.fileUrl}
			<a
				class="w-fit font-bold text-navy-700 underline hover:no-underline"
				href={latest.fileUrl}
				target="_blank"
				rel="noopener noreferrer">{t('consents.view')}</a
			>
		{/if}
	{/if}

	<form class="flex flex-col gap-3 sm:max-w-md" onsubmit={submit}>
		<Input
			type="date"
			label={t('consents.form.signedOn')}
			max={yerevanDay(new Date())}
			required
			bind:value={signedOn}
		/>
		<div class="flex flex-col gap-1">
			<label class="text-sm font-bold text-ink-900" for="{titleId}-file"
				>{t('consents.form.file')}</label
			>
			<input
				id="{titleId}-file"
				bind:this={fileInput}
				type="file"
				accept={consentMimes.join(',')}
				aria-describedby="{titleId}-file-hint"
				required
				class="text-sm"
			/>
			<p id="{titleId}-file-hint" class="text-sm text-ink-700">{t('consents.form.fileHint')}</p>
		</div>
		<Button type="submit" loading={uploading} class="w-fit">{t('consents.form.submit')}</Button>
		{#if message}
			<FormMessage tone={message === 'consents.sent' ? 'success' : 'error'} text={t(message)} />
		{/if}
	</form>
</section>
