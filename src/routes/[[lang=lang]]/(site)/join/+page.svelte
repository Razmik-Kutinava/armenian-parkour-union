<script lang="ts">
	import MembershipFee from '#lib/components/site/MembershipFee.svelte';
	import PayFeeForm from '#lib/components/site/PayFeeForm.svelte';
	import SeoHead from '#lib/components/site/SeoHead.svelte';
	import { currentLocale, localizePath, t } from '#lib/i18n/index.svelte.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const href = (path: string) => localizePath(path, currentLocale());
	const link = 'font-bold text-navy-700 underline hover:text-navy-900';
</script>

<SeoHead seo={data.seo} />

<article class="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-10 sm:py-14">
	<h1 class="text-3xl font-bold text-ink-900 sm:text-4xl">{data.page?.title ?? t('join.title')}</h1>
	{#if data.page?.html}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		<div class="rich-text">{@html data.page.html}</div>
	{/if}

	<MembershipFee fee={data.fee}>
		{#if data.state === 'guest'}
			<p class="flex flex-wrap gap-4">
				<a
					class="rounded-md bg-accent-500 px-4 py-2 font-bold text-navy-950 hover:bg-accent-600"
					href={href('/register')}>{t('join.signUp')}</a
				>
				<a class={link} href="/login?returnTo={encodeURIComponent(href('/join'))}"
					>{t('join.logIn')}</a
				>
			</p>
		{:else if data.state === 'member'}
			<p class="text-ink-900">{t('join.member')}</p>
			<a class={link} href={href('/cabinet/membership')}>{t('join.cabinet')}</a>
		{:else}
			<PayFeeForm label="membership.pay.submit" error={form?.payError} />
		{/if}
	</MembershipFee>
</article>
