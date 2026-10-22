<script lang="ts">
	import { enhance } from '$app/forms';
	import Avatar from '#lib/components/site/Avatar.svelte';
	import { newsDate } from '#lib/components/site/news-date.ts';
	import { currentLocale, localizePath, t } from '#lib/i18n/index.svelte.ts';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const o = $derived(data.overview);
	const href = (path: string) => localizePath(path, currentLocale());
	const card = 'flex flex-col gap-2 rounded-md border border-line bg-surface p-5';
	const button =
		'inline-flex min-h-11 w-fit items-center rounded-md bg-accent-500 px-4 font-bold text-navy-950 hover:bg-accent-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500';
</script>

<svelte:head>
	<title>{t('cabinet.overview.title')} — {t('site.name')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex max-w-3xl flex-col gap-6">
	<div class="flex items-center gap-4">
		<Avatar name={o.name} url={data.avatarUrl} />
		<div>
			<h1 class="text-3xl font-bold text-ink-900">
				{t('cabinet.overview.hello', { name: o.firstName ?? o.name })}
			</h1>
			<p class="text-ink-700">
				{o.level
					? t('cabinet.overview.level', { level: t(`level.${o.level}`) })
					: t('cabinet.overview.noLevel')}
			</p>
		</div>
	</div>

	<section class={card} aria-labelledby="actions-title">
		<h2 id="actions-title" class="text-xl font-bold text-ink-900">
			{t('cabinet.overview.actions')}
		</h2>
		{#if o.actions.length === 0}
			<p class="text-ink-700">{t('cabinet.overview.allDone')}</p>
		{/if}
		<ul class="flex flex-col gap-3">
			{#each o.actions as action (action)}
				<li class="flex flex-col gap-2">
					<p>{t(`cabinet.action.${action}`)}</p>
					{#if action === 'verify_email'}
						<form method="POST" action="?/resendVerification" use:enhance>
							<button type="submit" class={button}>{t('cabinet.verify.resend')}</button>
						</form>
						{#if form?.verify}<p role="status" class="text-sm text-ink-700">
								{t(form.verify)}
							</p>{/if}
					{/if}
				</li>
			{/each}
		</ul>
	</section>

	<div class="grid gap-4 sm:grid-cols-2">
		<section class={card}>
			<h2 class="text-xl font-bold text-ink-900">{t('cabinet.overview.membership')}</h2>
			<p class="text-ink-900">
				{o.membership.active && o.membership.paidUntil
					? t('cabinet.membership.activeUntil', {
							date: newsDate(o.membership.paidUntil, currentLocale())
						})
					: t('cabinet.membership.none')}
			</p>
			{#if o.membership.waiting}
				<p class="text-info-fg">{t('cabinet.membership.waiting')}</p>
			{:else}
				<a class={button} href={href('/cabinet/membership')}>
					{t(
						o.membership.active || o.reminder ? 'cabinet.overview.renew' : 'cabinet.overview.join'
					)}
				</a>
			{/if}
		</section>
		<section class={card}>
			<h2 class="text-xl font-bold text-ink-900">{t('cabinet.overview.points')}</h2>
			<p class="text-3xl font-bold text-ink-900">{o.pointsBalance}</p>
			<a class="font-bold text-navy-700 underline hover:no-underline" href={href('/cabinet/points')}
				>{t('cabinet.overview.pointsHistory')}</a
			>
		</section>
	</div>
</div>
