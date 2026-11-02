<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { MessageKey } from '#lib/i18n/translate.ts';
	import type { OwnReport } from '#lib/server/services/volunteer/report-own.ts';
	import { reportMimes } from '#lib/validation/volunteer-report.ts';
	import { uploadReportPhoto } from './upload-report';

	let {
		invitationId,
		report
	}: {
		invitationId: string;
		report: OwnReport | undefined;
	} = $props();

	let busy = $state(false);
	let error = $state<MessageKey | null>(null);
	let key = $state('');

	const canSend = $derived(!report || report.status === 'rejected' || report.status === 'pending');

	async function onFile(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		busy = true;
		error = null;
		const result = await uploadReportPhoto(file).catch(() => ({
			ok: false as const,
			message: 'cabinet.volunteer.report.error' as const
		}));
		busy = false;
		if (!result.ok) {
			error = result.message;
			return;
		}
		key = result.key;
	}
</script>

{#if report?.status === 'pending'}
	<p class="text-sm text-info-fg">{t('cabinet.volunteer.reportPending')}</p>
{:else if report?.status === 'approved'}
	<p class="text-sm text-success-fg">
		{report.points && report.points > 0
			? t('cabinet.volunteer.reportApproved', { points: String(report.points) })
			: t('cabinet.volunteer.reportApprovedZero')}
	</p>
{:else if report?.status === 'rejected'}
	<p class="text-sm text-warning-fg">
		{t('cabinet.volunteer.reportRejected', { reason: report.reviewNote ?? '' })}
	</p>
{/if}

{#if canSend}
	<form method="POST" action="?/report" class="mt-2 flex flex-col gap-2">
		<input type="hidden" name="invitationId" value={invitationId} />
		<input type="hidden" name="key" value={key} />
		<p class="text-ink-600 text-sm">{t('cabinet.volunteer.reportHint')}</p>
		<label class="flex flex-col gap-1 text-sm">
			<span>{t('cabinet.volunteer.reportUrl')}</span>
			<input type="url" name="url" class="input" placeholder="https://" disabled={Boolean(key)} />
		</label>
		<label class="flex flex-col gap-1 text-sm">
			<span>{t('cabinet.volunteer.report')}</span>
			<input
				type="file"
				accept={reportMimes.join(',')}
				class="text-sm"
				disabled={busy}
				onchange={onFile}
			/>
			{#if key}<span class="text-success-fg">{t('cabinet.volunteer.report.hasFile')}</span>{/if}
		</label>
		<label class="flex flex-col gap-1 text-sm">
			<span>{t('cabinet.volunteer.reportNote')}</span>
			<textarea name="note" class="input" rows="2" maxlength="1000"></textarea>
		</label>
		{#if error}
			<p class="text-sm text-error-fg" role="alert">{t(error)}</p>
		{/if}
		<button type="submit" class="btn btn-secondary btn-sm w-fit" disabled={busy}>
			{report?.status === 'pending'
				? t('cabinet.volunteer.reportReplace')
				: t('cabinet.volunteer.reportSend')}
		</button>
	</form>
{/if}
