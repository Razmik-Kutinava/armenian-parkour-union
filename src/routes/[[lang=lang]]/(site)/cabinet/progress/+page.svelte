<script lang="ts">
	import Badge from '#lib/components/ui/Badge.svelte';
	import { currentLocale, localizePath, t } from '#lib/i18n/index.svelte.ts';
	import LevelScale from './LevelScale.svelte';
	import OwnCertificate from './OwnCertificate.svelte';
	import OwnExams from './OwnExams.svelte';
	import type { PageProps } from './$types';

	/* docs/06 section 5.5. Whether a coach profile is public is the admin's (docs/04, staff_profiles.write):
	 * the member only sees it. */
	let { data }: PageProps = $props();
	const h2 = 'text-xl font-bold text-ink-900';
</script>

<svelte:head>
	<title>{t('cabinet.progress.title')} — {t('site.name')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex max-w-4xl flex-col gap-6">
	<h1 class="text-3xl font-bold text-ink-900">{t('cabinet.progress.title')}</h1>

	<LevelScale level={data.level} next={data.next} />

	<section class="flex flex-col gap-3" aria-labelledby="exams-title">
		<h2 id="exams-title" class={h2}>{t('cabinet.progress.exams')}</h2>
		{#if data.exams.length === 0}
			<p class="text-ink-700">{t('cabinet.progress.examsEmpty')}</p>
		{:else}
			<OwnExams exams={data.exams} />
		{/if}
	</section>

	<section class="flex flex-col gap-3" aria-labelledby="certificates-title">
		<h2 id="certificates-title" class={h2}>{t('cabinet.progress.certificates')}</h2>
		{#if data.certificates.length === 0}
			<p class="text-ink-700">{t('cabinet.progress.certificatesEmpty')}</p>
		{:else}
			<ul class="flex flex-col gap-4">
				{#each data.certificates as cert (cert.id)}<OwnCertificate {cert} />{/each}
			</ul>
		{/if}
	</section>

	{#if data.staff.length > 0}
		<section
			class="flex flex-col gap-3 rounded-md border border-line bg-surface p-5"
			aria-labelledby="staff-title"
		>
			<h2 id="staff-title" class={h2}>{t('cabinet.progress.staff')}</h2>
			<ul class="flex flex-col gap-3">
				{#each data.staff as profile (profile.kind)}
					<li class="flex flex-col gap-1">
						<p class="font-bold text-ink-900">
							{t(`certificates.admin.kind.${profile.kind}`)}{profile.category
								? ` — ${profile.category}`
								: ''}
						</p>
						{#if profile.licenseNumber}
							<p class="text-sm text-ink-700">
								{t('cabinet.progress.staff.license')}: {profile.licenseNumber}
							</p>
						{/if}
						<Badge tone={profile.isPublic ? 'success' : 'neutral'}>
							{t(
								profile.isPublic ? 'cabinet.progress.staff.public' : 'cabinet.progress.staff.hidden'
							)}
						</Badge>
					</li>
				{/each}
			</ul>
			<p class="text-sm text-ink-700">{t('cabinet.progress.staff.hint')}</p>
			{#if data.staff.some((p) => p.isPublic)}
				<a
					class="font-bold text-navy-700 underline hover:no-underline"
					href={localizePath('/federation/team', currentLocale())}
					>{t('cabinet.progress.staff.team')}</a
				>
			{/if}
		</section>
	{/if}
</div>
