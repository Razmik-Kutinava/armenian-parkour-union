<script lang="ts">
	import { newsDate } from '#lib/components/site/news-date.ts';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import type { OwnInvite } from '#lib/server/services/volunteer/invite-own.ts';
	import type { OwnReport } from '#lib/server/services/volunteer/report-own.ts';
	import type { MessageKey } from '#lib/i18n/translate.ts';
	import ReportForm from './ReportForm.svelte';

	let {
		open,
		past,
		reports,
		result
	}: {
		open: OwnInvite[];
		past: OwnInvite[];
		reports: Record<string, OwnReport>;
		result?: { answered?: boolean; reportSent?: boolean; message?: MessageKey };
	} = $props();

	const day = (d: Date) => newsDate(d, currentLocale());
</script>

<section class="flex flex-col gap-4">
	<h2 class="text-xl font-semibold text-ink-900">{t('cabinet.volunteer.invites')}</h2>
	{#if result?.answered}
		<p class="text-success-fg" role="status">{t('cabinet.volunteer.inviteAnswered')}</p>
	{:else if result?.reportSent}
		<p class="text-success-fg" role="status">{t('cabinet.volunteer.report.sent')}</p>
	{:else if result?.message}
		<p class="text-error-fg" role="alert">{t(result.message)}</p>
	{/if}

	{#if open.length === 0 && past.length === 0}
		<p class="text-ink-600">{t('cabinet.volunteer.invitesEmpty')}</p>
	{:else}
		{#if open.length > 0}
			<h3 class="text-ink-800 font-medium">{t('cabinet.volunteer.invitesOpen')}</h3>
			<ul class="flex flex-col gap-4">
				{#each open as invite (invite.id)}
					<li class="border-ink-100 border-b pb-4">
						<p class="font-semibold">{pickLocalized(invite.title, currentLocale())}</p>
						<p class="text-ink-600 text-sm">
							{day(invite.startsAt)}{#if invite.location}
								· {invite.location}{/if}
						</p>
						<p class="text-ink-600 text-sm">
							{t('cabinet.volunteer.placesLeft', { n: String(invite.placesLeft) })} ·
							{t('cabinet.volunteer.respondBy', { date: day(invite.respondBy) })}
						</p>
						{#if invite.status === 'accepted'}
							<p class="text-sm text-success-fg">{t('cabinet.volunteer.inviteAccepted')}</p>
						{:else if invite.status === 'declined'}
							<p class="text-sm text-ink-700">{t('cabinet.volunteer.inviteDeclined')}</p>
						{/if}
						{#if invite.canAccept || invite.canDecline}
							<div class="mt-2 flex flex-wrap gap-2">
								{#if invite.canAccept}
									<form method="POST" action="?/answer">
										<input type="hidden" name="invitationId" value={invite.id} />
										<input type="hidden" name="answer" value="accepted" />
										<button type="submit" class="btn btn-primary btn-sm"
											>{t('cabinet.volunteer.accept')}</button
										>
									</form>
								{/if}
								{#if invite.canDecline}
									<form method="POST" action="?/answer">
										<input type="hidden" name="invitationId" value={invite.id} />
										<input type="hidden" name="answer" value="declined" />
										<button type="submit" class="btn btn-secondary btn-sm"
											>{t('cabinet.volunteer.decline')}</button
										>
									</form>
								{/if}
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
		{#if past.length > 0}
			<h3 class="text-ink-800 font-medium">{t('cabinet.volunteer.invitesPast')}</h3>
			<ul class="flex flex-col gap-4">
				{#each past as invite (invite.id)}
					<li class="border-ink-100 border-b pb-4 text-sm">
						<span class="font-medium">{pickLocalized(invite.title, currentLocale())}</span>
						· {t(`volunteer.requests.answer.${invite.status}`)}
						{#if invite.status === 'attended'}
							<div class="mt-2">
								<ReportForm invitationId={invite.id} report={reports[invite.id]} />
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	{/if}
</section>
