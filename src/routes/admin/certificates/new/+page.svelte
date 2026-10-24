<script lang="ts">
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import IssueForm from './IssueForm.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 8: find the member by name or email (admin only), then issue. */
	let { data, form }: PageProps = $props();
	const levelOf = (level: 'novice' | 'advanced' | 'pro' | null) =>
		level ? t(`level.${level}`) : t('exams.new.noLevel');
</script>

<svelte:head><title>{t('certificates.new')} — {t('admin.title')}</title></svelte:head>

<h1 class="mb-6 text-2xl font-bold">{t('certificates.new')}</h1>

<div class="flex max-w-3xl flex-col gap-6">
	<FormSection title={t('exams.new.find')}>
		{#if data.member}
			<p class="text-ink-900">
				<span class="font-bold">{data.member.name}</span>
				<span class="text-ink-700">· {t('exams.new.level')}: {levelOf(data.member.level)}</span>
			</p>
			{#if data.member.status === 'blocked'}
				<p role="alert" class="rounded-md bg-error-bg p-3 text-sm text-error-fg">
					{t('certificates.refusal.blocked')}
				</p>
			{/if}
			<a class="w-fit font-bold text-navy-700 underline" href="/admin/certificates/new"
				>{t('exams.new.change')}</a
			>
		{:else}
			<form method="GET" class="flex flex-wrap items-end gap-3" role="search">
				<div class="min-w-64 flex-1">
					<Input
						label={t('exams.new.queryFull')}
						name="q"
						type="search"
						value={data.q}
						maxlength={200}
						required
						error={data.memberMissing ? t('certificates.refusal.user_not_found') : undefined}
					/>
				</div>
				<Button type="submit" variant="secondary">{t('exams.new.search')}</Button>
			</form>
			{#if data.found && data.found.length === 0}
				<p class="text-sm text-ink-700">{t('exams.new.none')}</p>
			{:else if data.found}
				<ul class="flex flex-col gap-2">
					{#each data.found as person (person.id)}
						<li>
							<a
								class="font-bold text-navy-700 underline-offset-2 hover:underline"
								href="/admin/certificates/new?member={person.id}">{person.name}</a
							>
							<span class="text-sm text-ink-700">· {levelOf(person.level)}</span>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</FormSection>

	{#if data.member}
		<IssueForm
			memberId={data.member.id}
			prefill={data.prefill}
			exams={data.exams}
			staffValidMonths={data.staffValidMonths}
			{form}
		/>
	{/if}
</div>
