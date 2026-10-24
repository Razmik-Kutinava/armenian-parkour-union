<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import CertificateState from '../CertificateState.svelte';
	import { certificateDay, levelOrCategory } from '../format';
	import { pdfMessage } from '../outcome';
	import CertificateActions from './CertificateActions.svelte';
	import VerifyLink from './VerifyLink.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 8: the certificate; the number is never edited. */
	let { data, form }: PageProps = $props();
	const card = $derived(data.card);
	const revoked = $derived(card.state === 'revoked');
	const dl = 'grid gap-x-6 gap-y-2 sm:grid-cols-[12rem_1fr]';
</script>

<svelte:head><title>{card.number} — {t('admin.title')}</title></svelte:head>

<div class="mb-4 flex flex-wrap items-center gap-3">
	<h1 class="text-2xl font-bold">{card.number}</h1>
	<CertificateState state={card.state} />
</div>

{#if form?.done}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t(form.done)}
	</p>
{:else if form?.message}
	<p role="alert" class="mb-4 rounded-md bg-error-bg p-3 text-sm text-error-fg">
		{t(form.message)}
	</p>
{:else if data.issued}
	<div role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		<p>{t('certificates.issued')}</p>
		{#if data.issuedPdf && data.issuedPdf !== 'ok'}<p>{t(pdfMessage(data.issuedPdf))}</p>{/if}
	</div>
{/if}

<div class="flex max-w-3xl flex-col gap-6">
	<dl class={dl}>
		<dt class="font-bold">{t('certificates.card.member')}</dt>
		<dd>
			<a class="text-navy-700 underline" href="/admin/users/{card.userId}">{card.memberName}</a>
		</dd>
		<dt class="font-bold">{t('certificates.col.kind')}</dt>
		<dd>{t(`certificates.admin.kind.${card.kind}`)}</dd>
		<dt class="font-bold">{t('certificates.col.levelOrCategory')}</dt>
		<dd>{levelOrCategory(card)}</dd>
		<dt class="font-bold">{t('certificates.col.issuedAt')}</dt>
		<dd>{certificateDay(card.issuedAt)}</dd>
		<dt class="font-bold">{t('certificates.col.expiresAt')}</dt>
		<dd>{certificateDay(card.expiresAt)}</dd>
		<dt class="font-bold">{t('certificates.card.exam')}</dt>
		<dd>
			{#if card.examId && card.examKind}
				<a class="text-navy-700 underline" href="/admin/exams/{card.examId}"
					>{t(`exams.kind.${card.examKind}`)}</a
				>
			{:else}—{/if}
		</dd>
		<dt class="font-bold">{t('certificates.card.issuedBy')}</dt>
		<dd>{card.issuedByName}</dd>
		{#if revoked}
			<dt class="font-bold">{t('certificates.card.revokedAt')}</dt>
			<dd>{certificateDay(card.revokedAt)}</dd>
			<dt class="font-bold">{t('certificates.card.revokeReason')}</dt>
			<dd class="whitespace-pre-line">{card.revokeReason}</dd>
		{/if}
	</dl>

	<VerifyLink url={data.verifyUrl} />

	<CertificateActions
		pdfUrl={data.pdfUrl}
		canRemake={data.canRemake && !revoked}
		canRevoke={data.canRevoke && !revoked}
	/>
</div>
