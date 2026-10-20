<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import AccountForms from './AccountForms.svelte';
	import ProfileForm from './ProfileForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>{t('cabinet.profile.title')} — {t('site.name')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex max-w-3xl flex-col gap-6">
	<h1 class="text-3xl font-bold text-ink-900">{t('cabinet.profile.title')}</h1>
	<ProfileForm profile={data.profile} countries={data.countries} result={form?.profile} />
	<AccountForms
		email={data.profile.email}
		hasPassword={data.profile.hasPassword}
		emailResult={form?.email}
		passwordResult={form?.password}
		setupResult={form?.setup}
	/>
</div>
