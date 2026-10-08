<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';

	type Props = { page: number; pages: number; href: (page: number) => string };
	let { page, pages, href }: Props = $props();
	const link = 'font-bold text-navy-700 underline-offset-2 hover:underline';
</script>

{#if pages > 1}
	<nav class="flex justify-between" aria-label={t('table.pagination')}>
		{#if page > 1}
			<a class={link} href={href(page - 1)}>← {t('events.earlier')}</a>
		{:else}<span></span>{/if}
		<span class="text-ink-500">{t('table.pageOf', { page, pages })}</span>
		{#if page < pages}
			<a class={link} href={href(page + 1)}>{t('events.later')} →</a>
		{:else}<span></span>{/if}
	</nav>
{/if}
