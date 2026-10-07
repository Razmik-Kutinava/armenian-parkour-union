<script lang="ts">
	import { page } from '$app/state';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { NavGroup } from '#lib/server/admin/nav.ts';
	import { navIcons } from './nav-icons';

	/* docs/08 section 8.3: dark, 240 px, grouped with icons; on phones opened from the top bar. */
	let { nav, open }: { nav: NavGroup[]; open: boolean } = $props();

	const isCurrent = (href: string) =>
		href === '/admin'
			? page.url.pathname === href
			: page.url.pathname === href || page.url.pathname.startsWith(`${href}/`);
</script>

<aside
	id="admin-sidebar"
	class="{open
		? 'fixed inset-y-0 left-0 z-40 flex shadow-lg'
		: 'hidden'} w-60 shrink-0 flex-col overflow-y-auto bg-navy-900 text-navy-100 lg:sticky lg:top-0 lg:flex lg:h-screen lg:shadow-none"
>
	<a
		href="/admin"
		class="m-2 rounded-sm px-3 py-3 font-bold text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
	>
		{t('site.name')}
	</a>
	<nav aria-label={t('admin.sections')} class="flex flex-col gap-4 px-2 pb-6">
		{#each nav as group (group.key)}
			<div>
				<p class="px-3 pb-1 text-xs font-bold tracking-wide text-navy-300 uppercase">
					{t(group.key)}
				</p>
				<ul class="flex flex-col">
					{#each group.items as item (item.href)}
						{@const Icon = navIcons[item.icon]}
						<li>
							<a
								href={item.href}
								aria-current={isCurrent(item.href) ? 'page' : undefined}
								class="flex min-h-11 items-center gap-3 rounded-sm px-3 text-sm font-bold hover:bg-navy-800 hover:text-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500 aria-[current=page]:bg-navy-800 aria-[current=page]:text-accent-500"
							>
								<Icon class="size-4 shrink-0" aria-hidden="true" />
								{t(item.key)}
							</a>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</nav>
</aside>
