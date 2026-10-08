<script lang="ts">
	import FormLayout from '#lib/components/admin/FormLayout.svelte';
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import LocalizedInput from '#lib/components/admin/LocalizedInput.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import FooterLinks from './FooterLinks.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 21; groups of stage 1 — decisions.md 2026-10-07. */
	let { data, form }: PageProps = $props();
	const values = $derived<Record<string, string | undefined>>(form?.values ?? data.values);
	const errors = $derived(
		Object.fromEntries(
			Object.entries((form && 'errors' in form && form.errors) || {}).map(([k, v]) => [
				k,
				v && t(v)
			])
		)
	);
	const socials = [
		['instagram', 'Instagram'],
		['youtube', 'YouTube'],
		['telegram', 'Telegram'],
		['facebook', 'Facebook'],
		['tiktok', 'TikTok']
	] as const;
	const field = (name: string, label: string, type = 'text') => ({
		name,
		label,
		type,
		value: values[name] ?? '',
		error: errors[name]
	});
</script>

<svelte:head><title>{t('admin.nav.settings')} — {t('admin.title')}</title></svelte:head>

<h1 class="mb-6 text-2xl font-bold">{t('admin.nav.settings')}</h1>

{#if form?.saved}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t('users.saved')}
	</p>
{:else if form && 'errors' in form}
	<p role="alert" class="mb-4 rounded-md bg-error-bg p-3 text-sm text-error-fg">
		{t('settings.fixErrors')}
	</p>
{/if}

<FormLayout cancelHref="/admin" novalidate>
	<FormSection title={t('settings.main')}>
		<LocalizedInput name="site_name" label={t('settings.siteName')} {values} {errors} required />
		<LocalizedInput name="seo_description" label={t('settings.seo')} {values} {errors} required />
	</FormSection>
	<FormSection title={t('footer.contacts')}>
		<div class="grid gap-4 sm:grid-cols-2">
			<Input {...field('contacts.email', t('auth.email'), 'email')} />
			<Input {...field('contacts.phone', t('users.phone'), 'tel')} />
		</div>
		<LocalizedInput name="contacts.address" label={t('settings.address')} {values} {errors} />
		<Input {...field('contacts.mapUrl', t('settings.mapUrl'), 'url')} />
	</FormSection>
	<FormSection title={t('footer.socials')} text={t('settings.httpsHint')}>
		{#each socials as [key, label] (key)}
			<Input {...field(`socials.${key}`, label, 'url')} />
		{/each}
	</FormSection>
	<FormSection title={t('settings.footer')}>
		<LocalizedInput name="footer.text" label={t('settings.footerText')} {values} {errors} />
	</FormSection>
	<FormSection title={t('settings.links')} text={t('settings.linksHint')}>
		<FooterLinks {values} {errors} />
	</FormSection>
	<FormSection title={t('footer.requisites')}>
		<LocalizedInput name="requisites.text" label={t('footer.requisites')} {values} {errors} />
	</FormSection>
</FormLayout>
