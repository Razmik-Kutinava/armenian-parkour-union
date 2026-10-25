<script lang="ts">
	import { page } from '$app/state';
	import { eventMoment } from '#lib/components/site/event-date.ts';
	import PayFeeForm from '#lib/components/site/PayFeeForm.svelte';
	import { currentLocale, localizePath, t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import type { ShownRegistration, ViewRefusal } from '#lib/server/services/registrations/index.ts';
	import CancelForm from './CancelForm.svelte';
	import RegisterForm from './RegisterForm.svelte';

	/* docs/06 section 4.3: the state comes from the server service; this only shows it. */
	type Props = {
		view: ShownRegistration;
		paid: boolean;
		/** The answer of the last register / cancel. */
		notice?: { message: MessageKey | null; error: boolean } | null;
		payError?: MessageKey | null;
	};
	let { view, paid, notice, payError }: Props = $props();

	const links: Partial<Record<ViewRefusal, { path: string; label: MessageKey }>> = {
		no_membership: { path: '/join', label: 'registrations.link.join' },
		parental_consent: { path: '/cabinet/documents', label: 'registrations.link.documents' },
		birth_date_required: { path: '/cabinet/profile', label: 'registrations.link.profile' },
		email_unverified: { path: '/cabinet', label: 'registrations.link.cabinet' }
	};
	const link = 'font-bold text-navy-700 underline hover:text-navy-900';
	const href = (path: string) => localizePath(path, currentLocale());
	const moment = (date: Date) => eventMoment(date, currentLocale());
	let now = $state(Date.now());
	$effect(() => {
		const timer = setInterval(() => (now = Date.now()), 15_000);
		return () => clearInterval(timer);
	});
	const minutesLeft = (until: Date) => Math.max(0, Math.ceil((until.getTime() - now) / 60_000));
</script>

{#if notice?.message}
	<p
		role={notice.error ? 'alert' : 'status'}
		class="rounded-md p-3 text-sm {notice.error
			? 'bg-error-bg text-error-fg'
			: 'bg-info-bg text-info-fg'}"
	>
		{t(notice.message)}
	</p>
{/if}

{#if view.state === 'guest'}
	<a
		class="rounded-md bg-accent-500 px-4 py-2 text-center font-bold text-navy-950 hover:bg-accent-600"
		href="/login?returnTo={encodeURIComponent(page.url.pathname)}">{t('registrations.guest')}</a
	>
{:else if view.state === 'refused'}
	{#if view.reason === 'not_open' && view.opensAt}
		<p class="text-sm text-ink-700">{t('registrations.opensAt', { date: moment(view.opensAt) })}</p>
	{:else if view.reason !== 'closed'}
		<p class="text-sm text-ink-900">{t(`registrations.refused.${view.reason}`)}</p>
		{#if links[view.reason]}
			<a class="text-sm {link}" href={href(links[view.reason]!.path)}
				>{t(links[view.reason]!.label)}</a
			>
		{/if}
	{/if}
{:else if view.state === 'open'}
	{#if view.full}
		<p class="text-sm text-ink-700">{t('registrations.full')}</p>
	{/if}
	{#if paid}
		<p class="text-sm text-ink-700">{t('registrations.paidNote')}</p>
	{/if}
	<RegisterForm full={view.full} options={view.categories} />
{:else if view.state === 'mine'}
	{#if view.status === 'attended' || view.status === 'no_show'}
		<p class="font-bold text-ink-900">{t('registrations.attended')}</p>
	{:else if view.status === 'registered'}
		<p class="font-bold text-success-fg">{t('registrations.registered')}</p>
	{:else if view.status === 'waitlist'}
		<p class="font-bold text-ink-900">{t('registrations.waitlist')}</p>
	{:else if view.expired || !view.holdUntil}
		<p class="text-sm text-ink-700">{t('registrations.expired')}</p>
	{:else}
		<p class="text-sm text-ink-900">
			{t('registrations.held', { time: moment(view.holdUntil) })}
			<span class="font-bold"
				>{t('registrations.heldLeft', { minutes: minutesLeft(view.holdUntil) })}</span
			>
		</p>
		<PayFeeForm label="registrations.pay" error={payError} />
	{/if}
	{#if view.cancelUntil}
		<p class="text-sm text-ink-700">
			{t('registrations.cancelUntil', { date: moment(view.cancelUntil) })}
		</p>
		<CancelForm
			label={view.status === 'waitlist' ? 'registrations.leaveWaitlist' : 'registrations.cancel'}
		/>
	{:else if view.status !== 'attended' && view.status !== 'no_show'}
		<p class="text-sm text-ink-700">{t('registrations.cancelLate')}</p>
	{/if}
{/if}
