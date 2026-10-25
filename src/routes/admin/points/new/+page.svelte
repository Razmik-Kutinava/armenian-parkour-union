<script lang="ts">
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Modal from '#lib/components/ui/Modal.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { PageProps } from './$types';

	/* docs/05 section 12, docs/03 section 6.3: balance before and after, a comment, confirmation. */
	let { data, form }: PageProps = $props();
	const values: Record<string, string> = $derived(form?.values ?? {});
	const errors = $derived<Record<string, string | undefined>>(
		Object.fromEntries(Object.entries(form?.errors ?? {}).map(([k, v]) => [k, v && t(v)]))
	);
	let delta = $derived(values.delta ?? '');
	let confirmOpen = $state(false);
	const after = $derived.by(() => {
		const n = Number(delta.trim());
		return data.member && Number.isInteger(n) ? String(data.member.balance + n) : '—';
	});
	const ledgerHref = $derived(
		data.member ? `/admin/points?q=${encodeURIComponent(data.member.email)}` : '/admin/points'
	);
</script>

<svelte:head><title>{t('points.adjust')} — {t('admin.title')}</title></svelte:head>

<h1 class="mb-6 text-2xl font-bold">{t('points.adjust')}</h1>

{#if form?.done}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t('points.new.done', { before: String(form.done.before), after: String(form.done.after) })}
		<a class="ml-2 font-bold underline" href={ledgerHref}>{t('points.new.toLedger')}</a>
	</p>
{:else if form?.message}
	<p role="alert" class="mb-4 rounded-md bg-error-bg p-3 text-sm text-error-fg">
		{t(form.message)}
	</p>
{/if}

<div class="flex flex-col gap-6">
	<FormSection title={t('points.new.member')}>
		<form method="GET" class="flex flex-wrap items-end gap-3">
			<div class="min-w-64 flex-1">
				<Input
					label={t('points.new.email')}
					name="email"
					type="email"
					value={data.email}
					error={data.searched && !data.member ? t('points.error.memberNotFound') : undefined}
					required
				/>
			</div>
			<Button type="submit" variant="secondary">{t('points.new.find')}</Button>
		</form>
		{#if data.member}
			<p class="text-ink-900">
				<span class="font-bold">{data.member.name ?? data.member.email}</span>
				<span class="text-ink-700">({data.member.email})</span>
			</p>
			<p class="font-bold">{t('points.new.balance', { balance: String(data.member.balance) })}</p>
		{/if}
	</FormSection>

	{#if data.member}
		<form id="adjust-form" method="POST" class="flex flex-col gap-6">
			<input type="hidden" name="userId" value={data.member.id} />
			<FormSection title={t('points.col.delta')}>
				<Input
					label={t('points.new.delta')}
					name="delta"
					inputmode="numeric"
					hint={t('points.new.deltaHint')}
					bind:value={delta}
					error={errors.delta}
					required
				/>
				<Input
					label={t('points.new.comment')}
					name="comment"
					maxlength={1000}
					value={values.comment ?? ''}
					error={errors.comment}
					required
				/>
			</FormSection>
			<div class="flex justify-end">
				<Button onclick={() => (confirmOpen = true)}>{t('points.new.continue')}</Button>
			</div>
		</form>
		<Modal bind:open={confirmOpen} title={t('points.new.confirmTitle')}>
			<p class="text-lg font-bold">
				{t('points.new.confirmText', { before: String(data.member.balance), after })}
			</p>
			{#snippet footer()}
				<Button variant="ghost" onclick={() => (confirmOpen = false)}>{t('form.cancel')}</Button>
				<Button type="submit" form="adjust-form">{t('form.save')}</Button>
			{/snippet}
		</Modal>
	{/if}
</div>
