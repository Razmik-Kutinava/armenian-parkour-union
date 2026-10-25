<script lang="ts">
	import Avatar from '#lib/components/site/Avatar.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { certificateDay } from '../../certificates/format';
	import StaffForm from './StaffForm.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 9: the profile; the moderator only views it. */
	let { data, form }: PageProps = $props();
	const card = $derived(data.card);
	const stored = $derived({
		category: card.category ?? '',
		licenseNumber: card.licenseNumber ?? '',
		bioEn: card.bio?.en ?? '',
		bioHy: card.bio?.hy ?? '',
		bioRu: card.bio?.ru ?? '',
		isPublic: card.isPublic ? 'on' : '',
		isActive: card.isActive ? 'on' : ''
	});
	const values = $derived<Record<string, string | undefined>>(form?.values ?? stored);
	const yesNo = (value: boolean) => t(value ? 'staff.flag.yes' : 'staff.flag.no');
	const dl = 'grid gap-x-6 gap-y-2 sm:grid-cols-[12rem_1fr]';
</script>

<svelte:head><title>{card.memberName} — {t('admin.title')}</title></svelte:head>

<h1 class="mb-4 text-2xl font-bold">{card.memberName}</h1>

{#if form?.done}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t(form.done)}
	</p>
{/if}

<div class="flex max-w-3xl flex-col gap-6">
	<dl class={dl}>
		<dt class="font-bold">{t('staff.col.member')}</dt>
		<dd>
			<a class="text-navy-700 underline" href="/admin/users/{card.userId}">{card.memberName}</a>
		</dd>
		<dt class="font-bold">{t('staff.col.kind')}</dt>
		<dd>{t(`certificates.admin.kind.${card.kind}`)}</dd>
		<dt class="font-bold">{t('staff.card.photo')}</dt>
		<dd class="flex items-center gap-3">
			<Avatar name={card.memberName} url={data.photoUrl} alt={card.memberName} />
			<span class="text-sm text-ink-700">{t('staff.card.photoHint')}</span>
		</dd>
		<dt class="font-bold">{t('staff.card.certificate')}</dt>
		<dd>
			{#if card.certificate}
				<a class="text-navy-700 underline" href="/admin/certificates/{card.certificate.id}"
					>{card.certificate.number}</a
				>
				{#if card.certificate.expiresAt}
					{t('staff.card.until', { date: certificateDay(card.certificate.expiresAt) })}
				{/if}
			{:else}{t('staff.card.noCertificate')}{/if}
		</dd>
		{#if !data.canEdit}
			<dt class="font-bold">{t('staff.col.category')}</dt>
			<dd>{card.category ?? '—'}</dd>
			<dt class="font-bold">{t('staff.col.license')}</dt>
			<dd>{card.licenseNumber ?? '—'}</dd>
			<dt class="font-bold">{t('staff.form.bio')}</dt>
			<dd class="whitespace-pre-line">{card.bio?.en ?? '—'}</dd>
			<dt class="font-bold">{t('staff.col.public')}</dt>
			<dd>{yesNo(card.isPublic)}</dd>
			<dt class="font-bold">{t('staff.col.active')}</dt>
			<dd>{yesNo(card.isActive)}</dd>
		{/if}
	</dl>

	{#if data.canEdit}
		<StaffForm {values} errors={form?.errors} />
	{/if}
</div>
