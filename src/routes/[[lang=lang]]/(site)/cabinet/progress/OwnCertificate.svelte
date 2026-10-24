<script lang="ts">
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import { newsDate } from '#lib/components/site/news-date.ts';
	import { currentLocale, localizePath, t } from '#lib/i18n/index.svelte.ts';
	import type { PageData } from './$types';

	/* docs/06 section 5.5: type, number, dates, status; PDF, the verify link and its QR — not for a
	 * revoked certificate (the load gives it none). */
	let { cert }: { cert: PageData['certificates'][number] } = $props();
	const tones = { active: 'success', expired: 'warning', revoked: 'error' } as const;
	const title = $derived(
		cert.kind !== 'level'
			? t(`certificates.kind.${cert.kind}`)
			: cert.level
				? t(`certificates.kind.level_${cert.level}`)
				: t('certificates.admin.kind.level')
	);
	const day = (d: Date | null) => (d ? newsDate(d, currentLocale()) : '—');
	const href = (path: string) => localizePath(path, currentLocale());
	const link = 'font-bold text-navy-700 underline hover:no-underline';
	let copied = $state(false);

	async function copy(url: string) {
		await navigator.clipboard.writeText(url);
		copied = true;
	}
</script>

<li class="flex flex-col gap-3 rounded-md border border-line bg-surface p-5">
	<div class="flex flex-wrap items-center gap-3">
		<h3 class="text-lg font-bold text-ink-900">{title}</h3>
		<Badge tone={tones[cert.state]}>{t(`certificates.verify.state.${cert.state}`)}</Badge>
	</div>
	<dl class="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[10rem_1fr]">
		<dt class="text-ink-700">{t('certificates.col.number')}</dt>
		<dd class="font-bold text-ink-900">{cert.number}</dd>
		{#if cert.category}
			<dt class="text-ink-700">{t('certificates.pdf.category')}</dt>
			<dd>{cert.category}</dd>
		{/if}
		<dt class="text-ink-700">{t('certificates.col.issuedAt')}</dt>
		<dd>{day(cert.issuedAt)}</dd>
		<dt class="text-ink-700">{t('certificates.col.expiresAt')}</dt>
		<dd>{day(cert.expiresAt)}</dd>
	</dl>
	{#if cert.verifyUrl && cert.verifyPath && cert.qr}
		{@const verifyUrl = cert.verifyUrl}
		{#if cert.hasPdf}
			<a class={link} href={href(`/cabinet/progress/${cert.id}/pdf`)} data-sveltekit-reload
				>{t('cabinet.progress.pdf')}</a
			>
		{:else}
			<p class="text-sm text-ink-700">{t('cabinet.progress.pdfNone')}</p>
		{/if}
		<div class="flex flex-wrap items-end gap-3">
			<div class="min-w-64 flex-1">
				<Input label={t('certificates.card.verify')} value={verifyUrl} readonly />
			</div>
			<Button variant="secondary" onclick={() => copy(verifyUrl)}>
				{t('certificates.card.copy')}
			</Button>
			{#if copied}<p role="status" class="text-sm text-success-fg">
					{t('certificates.card.copied')}
				</p>{/if}
		</div>
		<a class={link} href={href(cert.verifyPath)}>{t('cabinet.progress.check')}</a>
		<details>
			<summary class="cursor-pointer font-bold text-navy-700">{t('cabinet.progress.qr')}</summary>
			<svg
				role="img"
				aria-label={t('cabinet.progress.qrLabel', { number: cert.number })}
				viewBox="-4 -4 {cert.qr.size + 8} {cert.qr.size + 8}"
				shape-rendering="crispEdges"
				class="mt-3 size-48"
			>
				<rect x="-4" y="-4" width={cert.qr.size + 8} height={cert.qr.size + 8} fill="#fff" />
				<path d={cert.qr.d} fill="#000" />
			</svg>
		</details>
	{/if}
</li>
