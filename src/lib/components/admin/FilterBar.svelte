<script lang="ts" module>
	export type Filter =
		| { key: string; label: string; type?: 'select'; options: { value: string; label: string }[] }
		| { key: string; label: string; type: 'date' };
</script>

<script lang="ts">
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import { page } from '$app/state';
	import Button from '#lib/components/ui/Button.svelte';
	import { controlClass } from '#lib/components/ui/control.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { listHref, type ListState } from './list-state';

	/* docs/08 section 8.3: filters above the table, active ones as chips, state in the URL (GET form). */
	let {
		filters,
		state,
		searchLabel
	}: { filters: Filter[]; state: ListState; searchLabel: string } = $props();

	const labelOf = (f: Filter, value: string) =>
		(f.type !== 'date' && f.options.find((o) => o.value === value)?.label) || value;
	const chips = $derived([
		...(state.q ? [{ key: 'q', text: `${searchLabel}: ${state.q}` }] : []),
		...filters
			.filter((f) => state.filters[f.key])
			.map((f) => ({ key: f.key, text: `${f.label}: ${labelOf(f, state.filters[f.key])}` }))
	]);
	const remove = (key: string) =>
		listHref(page.url.pathname, page.url.searchParams, { [key]: null });
</script>

<div class="mb-4 flex flex-col gap-3">
	<form method="GET" class="flex flex-wrap items-end gap-3" role="search">
		<input type="hidden" name="sort" value={state.sort} />
		<input type="hidden" name="dir" value={state.dir} />
		<label class="flex min-w-48 flex-1 flex-col gap-1 text-sm font-bold text-ink-900">
			{searchLabel}
			<span class="relative">
				<Search
					class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-500"
					aria-hidden="true"
				/>
				<input
					type="search"
					name="q"
					value={state.q}
					maxlength="200"
					class="{controlClass} pr-3 pl-9 font-normal"
				/>
			</span>
		</label>
		{#each filters as f (f.key)}
			<label class="flex flex-col gap-1 text-sm font-bold text-ink-900">
				{f.label}
				{#if f.type === 'date'}
					<input
						type="date"
						name={f.key}
						value={state.filters[f.key] ?? ''}
						class="{controlClass} px-3 font-normal"
					/>
				{:else}
					<select name={f.key} class="{controlClass} min-w-36 px-3 font-normal">
						<option value="">{t('filter.any')}</option>
						{#each f.options as o (o.value)}
							<option value={o.value} selected={state.filters[f.key] === o.value}>{o.label}</option>
						{/each}
					</select>
				{/if}
			</label>
		{/each}
		<Button type="submit" variant="secondary">{t('filter.apply')}</Button>
	</form>

	{#if chips.length}
		<ul class="flex flex-wrap items-center gap-2" aria-label={t('filter.active')}>
			{#each chips as chip (chip.key)}
				<li>
					<a
						href={remove(chip.key)}
						class="inline-flex min-h-8 items-center gap-1 rounded-full bg-navy-100 px-3 text-sm text-navy-900 hover:bg-navy-300 focus-visible:outline-2 focus-visible:outline-navy-600"
						aria-label={t('filter.remove', { filter: chip.text })}
					>
						{chip.text}<X class="size-4" aria-hidden="true" />
					</a>
				</li>
			{/each}
			<li>
				<a href={page.url.pathname} class="text-sm font-bold text-navy-700 hover:underline"
					>{t('filter.reset')}</a
				>
			</li>
		</ul>
	{/if}
</div>
