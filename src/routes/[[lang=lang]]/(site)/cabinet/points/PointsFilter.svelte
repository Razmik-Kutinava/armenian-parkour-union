<script lang="ts">
	import type { ListState } from '#lib/components/admin/list-state.ts';
	import { currentLocale, localizePath, t } from '#lib/i18n/index.svelte.ts';
	import { POINTS_REASONS } from '#lib/validation/admin-points.ts';

	/* docs/06 section 5.6: filter by reason and period; a plain GET form, works without JS. */
	let { state }: { state: ListState } = $props();
	const field =
		'min-h-11 rounded-md border border-line bg-surface px-3 text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500';
	const label = 'flex flex-col gap-1 text-sm font-bold text-ink-700';
</script>

<form method="GET" class="flex flex-wrap items-end gap-3">
	<label class={label}>
		{t('points.col.reason')}
		<select name="reason" class={field} value={state.filters.reason ?? ''}>
			<option value="">{t('cabinet.points.allReasons')}</option>
			{#each POINTS_REASONS as reason (reason)}
				<option value={reason}>{t(`points.reason.${reason}`)}</option>
			{/each}
		</select>
	</label>
	<label class={label}>
		{t('points.filter.from')}
		<input type="date" name="from" class={field} value={state.filters.from ?? ''} />
	</label>
	<label class={label}>
		{t('points.filter.to')}
		<input type="date" name="to" class={field} value={state.filters.to ?? ''} />
	</label>
	<button
		type="submit"
		class="inline-flex min-h-11 items-center rounded-md bg-navy-900 px-4 font-bold text-surface hover:bg-navy-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-500"
	>
		{t('cabinet.points.show')}
	</button>
	{#if Object.keys(state.filters).length > 0}
		<a
			class="inline-flex min-h-11 items-center px-2 font-bold text-navy-700 underline hover:no-underline"
			href={localizePath('/cabinet/points', currentLocale())}>{t('cabinet.points.reset')}</a
		>
	{/if}
</form>
