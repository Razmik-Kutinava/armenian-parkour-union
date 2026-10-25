<script lang="ts">
	import { page } from '$app/state';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { localizePath } from '#lib/i18n/locales.ts';
	import type { OrderButton } from '#lib/server/services/shop/order-button.ts';

	/* docs/06 section 4.7 (button table); the state comes from the server. The order step — 7.6. */
	type Props = {
		slug: string;
		options: { name: string; values: string[] }[];
		button: OrderButton;
	};
	let { slug, options, button }: Props = $props();
	const href = (path: string) => localizePath(path, currentLocale());
	const primary =
		'rounded-md bg-accent-500 px-4 py-2 text-center font-bold text-navy-950 hover:bg-accent-600';
	const inactive = 'rounded-md bg-navy-100 px-4 py-2 text-center font-bold text-ink-500';
</script>

{#if button.state !== 'none'}
	<form method="GET" action={href(`/shop/${slug}/order`)} class="flex flex-col gap-4">
		{#each options as option (option.name)}
			<label class="flex flex-col gap-1">
				<span class="text-sm font-bold text-ink-900">{option.name}</span>
				<select
					name={option.name}
					required
					disabled={button.state !== 'can_order'}
					class="rounded-md border border-line bg-surface px-3 py-2"
				>
					<option value="" selected disabled>{t('shop.choose')}</option>
					{#each option.values as value (value)}<option {value}>{value}</option>{/each}
				</select>
			</label>
		{/each}

		{#if button.state === 'out_of_stock'}
			<button type="button" class={inactive} disabled>{t('shop.outOfStock')}</button>
		{:else if button.state === 'guest'}
			<a class={primary} href="/login?returnTo={encodeURIComponent(page.url.pathname)}"
				>{t('shop.button.guest')}</a
			>
		{:else if button.state === 'email_unverified'}
			<p class="text-sm text-ink-900">{t('shop.button.emailUnverified')}</p>
			<a
				class="text-sm font-bold text-navy-700 underline hover:text-navy-900"
				href={href('/cabinet')}>{t('shop.button.emailLink')}</a
			>
		{:else if button.state === 'short'}
			<button type="button" class={inactive} disabled
				>{t('shop.button.short', { points: button.missing })}</button
			>
		{:else}
			<button type="submit" class={primary}
				>{t('shop.button.order', { points: button.price })}</button
			>
		{/if}
	</form>
{/if}
