<script lang="ts" module>
	export type Viewer = { name: string; isStaff: boolean };
</script>

<script lang="ts">
	import { currentLocale, localizePath, t } from '#lib/i18n/index.svelte.ts';

	let { isStaff }: { isStaff: boolean } = $props();

	const item =
		'flex min-h-11 w-full items-center rounded-sm px-3 text-left font-bold text-navy-100 hover:bg-navy-800 hover:text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500';
</script>

<ul class="flex flex-col gap-1">
	<li><a class={item} href={localizePath('/cabinet', currentLocale())}>{t('nav.cabinet')}</a></li>
	{#if isStaff}
		<li><a class={item} href="/admin">{t('nav.admin')}</a></li>
	{/if}
	<li>
		<form method="POST" action={localizePath('/logout', currentLocale())}>
			<button type="submit" class={item}>{t('nav.logout')}</button>
		</form>
	</li>
</ul>
