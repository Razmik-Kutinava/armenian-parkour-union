<script lang="ts" module>
	export type Column = { key: string; label: string; sortable?: boolean; class?: string };
</script>

<script lang="ts" generics="Row extends { id: string }">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { sortHref, type ListState } from './list-state';
	import SortIcon from './SortIcon.svelte';

	/* docs/08 section 8.3: 44 px rows, sticky header, sort in the URL, row selection, cards on phones. */
	let {
		rows,
		columns,
		caption,
		cell,
		empty,
		state,
		selectable = false,
		selected = $bindable([])
	}: {
		rows: Row[];
		columns: Column[];
		caption: string;
		cell: Snippet<[Row, Column]>;
		empty: Snippet;
		state?: ListState;
		selectable?: boolean;
		selected?: string[];
	} = $props();

	const allSelected = $derived(rows.length > 0 && rows.every((r) => selected.includes(r.id)));
	const toggleAll = () => (selected = allSelected ? [] : rows.map((r) => r.id));
	const toggle = (id: string) =>
		(selected = selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
	const sortOf = (c: Column) =>
		state?.sort === c.key ? (state.dir === 'asc' ? 'ascending' : 'descending') : undefined;
	const box =
		'size-5 cursor-pointer accent-navy-700 focus-visible:outline-2 focus-visible:outline-navy-600';
</script>

{#if rows.length === 0}
	{@render empty()}
{:else}
	<div class="hidden max-h-[70vh] overflow-auto rounded-md border border-line bg-surface md:block">
		<table class="w-full border-collapse text-left text-sm">
			<caption class="sr-only">{caption}</caption>
			<thead class="sticky top-0 z-10 bg-navy-50 text-ink-700">
				<tr>
					{#if selectable}
						<th class="w-11 px-3"
							><input
								type="checkbox"
								class={box}
								checked={allSelected}
								onchange={toggleAll}
								aria-label={t('table.selectAll')}
							/></th
						>
					{/if}
					{#each columns as c (c.key)}
						<th
							scope="col"
							class="h-11 px-3 font-bold whitespace-nowrap {c.class ?? ''}"
							aria-sort={sortOf(c)}
						>
							{#if c.sortable && state}
								<a
									href={sortHref(page.url.pathname, page.url.searchParams, c.key, state)}
									class="inline-flex items-center gap-1 rounded-sm hover:text-navy-700 focus-visible:outline-2 focus-visible:outline-navy-600"
								>
									{c.label}<SortIcon dir={state.sort === c.key ? state.dir : null} />
								</a>
							{:else}
								{c.label}
							{/if}
						</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.id)}
					<tr
						class="h-11 border-t border-line hover:bg-navy-50 {selected.includes(row.id)
							? 'bg-accent-100'
							: ''}"
					>
						{#if selectable}
							<td class="px-3"
								><input
									type="checkbox"
									class={box}
									checked={selected.includes(row.id)}
									onchange={() => toggle(row.id)}
									aria-label={t('table.selectRow')}
								/></td
							>
						{/if}
						{#each columns as c (c.key)}
							<td class="px-3 py-2 {c.class ?? ''}">{@render cell(row, c)}</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<ul class="flex flex-col gap-3 md:hidden" aria-label={caption}>
		{#each rows as row (row.id)}
			<li class="rounded-md border border-line bg-surface p-4">
				{#if selectable}
					<label class="mb-2 flex min-h-11 items-center gap-3 text-sm text-ink-700">
						<input
							type="checkbox"
							class={box}
							checked={selected.includes(row.id)}
							onchange={() => toggle(row.id)}
						/>
						{t('table.selectRow')}
					</label>
				{/if}
				<dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
					{#each columns as c (c.key)}
						<dt class="text-ink-500">{c.label}</dt>
						<dd class="min-w-0 text-ink-900">{@render cell(row, c)}</dd>
					{/each}
				</dl>
			</li>
		{/each}
	</ul>
{/if}
