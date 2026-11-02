<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';
	import CardBlock from './CardBlock.svelte';
	import InvitesBlock from './InvitesBlock.svelte';
	import PerksBlock from './PerksBlock.svelte';
	import UsesBlock from './UsesBlock.svelte';
	import type { PageProps } from './$types';

	/* docs/06 section 5.12: card, perks, uses, invitations. */
	let { data, form }: PageProps = $props();
</script>

<svelte:head>
	<title>{t('cabinet.volunteer.title')} — {t('site.name')}</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex max-w-3xl flex-col gap-6">
	<h1 class="text-3xl font-bold text-ink-900">{t('cabinet.volunteer.title')}</h1>
	<CardBlock own={data.own} qr={data.qr} result={form} />
	{#if data.own.checkToken}
		<PerksBlock partners={data.own.partners} />
	{/if}
	{#if data.own.card}
		<UsesBlock redemptions={data.own.redemptions} />
	{/if}
	<InvitesBlock
		open={data.invites.open}
		past={data.invites.past}
		result={form && ('answered' in form || 'message' in form) ? form : undefined}
	/>
</div>
