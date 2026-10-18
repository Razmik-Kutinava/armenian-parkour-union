<script lang="ts">
	import GalleryHorizontal from '@lucide/svelte/icons/gallery-horizontal';
	import HeroSlider from '#lib/components/site/hero/HeroSlider.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { heroTypes } from '#lib/validation/hero-enums.ts';
	import HeroCard from './HeroCard.svelte';
	import HeroNotice from './HeroNotice.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 4. Order changes only on the full current list (no filters). */
	let { data, form }: PageProps = $props();
	const ids = $derived(data.rows.map((r) => r.id));
	const sortable = $derived(!data.filter.archived && !data.filter.type && !data.filter.active);
	const swapped = (i: number, j: number) => {
		const next = [...ids];
		[next[i], next[j]] = [next[j], next[i]];
		return next.join(',');
	};

	let dragged: number | null = $state(null);
	let orderForm: HTMLFormElement | undefined = $state();
	let orderInput: HTMLInputElement | undefined = $state();
	function drop(target: number) {
		if (dragged === null || dragged === target || !orderForm || !orderInput) return;
		const next = [...ids];
		const [moved] = next.splice(dragged, 1);
		next.splice(target, 0, moved);
		dragged = null;
		orderInput.value = next.join(',');
		orderForm.requestSubmit();
	}
</script>

<svelte:head><title>{t('hero.title')} — {t('admin.title')}</title></svelte:head>

<div class="mb-6 flex flex-wrap items-center justify-between gap-3">
	<h1 class="text-2xl font-bold">{t('hero.title')}</h1>
	<a
		href="/admin/hero/new"
		class="inline-flex min-h-10 items-center rounded-md bg-navy-700 px-4 font-bold text-surface hover:bg-navy-800"
		>{t('hero.create')}</a
	>
</div>

<HeroNotice {form} max={data.max} />

<section class="mb-8 flex flex-col gap-3">
	<h2 class="text-xl font-bold">{t('hero.now')}</h2>
	<p class="text-sm text-ink-500">{t('hero.nowHint', { max: data.max })}</p>
	<div class="overflow-hidden rounded-lg"><HeroSlider slides={data.slides} level={2} /></div>
</section>

<nav class="mb-4 flex gap-4 border-b border-line" aria-label={t('hero.list')}>
	{#each [false, true] as archive (archive)}
		<a
			href={archive ? '/admin/hero?archived=1' : '/admin/hero'}
			aria-current={data.filter.archived === archive ? 'page' : undefined}
			class="-mb-px border-b-2 px-1 pb-2 font-bold {data.filter.archived === archive
				? 'border-navy-700 text-navy-700'
				: 'border-transparent text-ink-500'}"
			>{archive ? t('hero.view.archive') : t('hero.view.current')}</a
		>
	{/each}
</nav>

<form method="GET" class="mb-4 flex flex-wrap items-end gap-3">
	{#if data.filter.archived}<input type="hidden" name="archived" value="1" />{/if}
	<Select
		label={t('hero.filter.type')}
		name="type"
		value={data.filter.type}
		options={[
			{ value: '', label: t('filter.any') },
			...heroTypes.map((v) => ({ value: v, label: t(`hero.type.${v}`) }))
		]}
	/>
	<Select
		label={t('hero.filter.active')}
		name="active"
		value={data.filter.active}
		options={[
			{ value: '', label: t('filter.any') },
			{ value: '1', label: t('hero.active.yes') },
			{ value: '0', label: t('hero.active.no') }
		]}
	/>
	<Button type="submit" variant="secondary">{t('filter.apply')}</Button>
</form>

{#if data.rows.length === 0}
	<EmptyState
		icon={GalleryHorizontal}
		title={data.filter.archived ? t('hero.emptyArchive') : t('hero.empty')}
	/>
{:else}
	{#if sortable}<p class="mb-2 text-sm text-ink-500">{t('hero.orderHint')}</p>{/if}
	<form method="POST" action="?/reorder" bind:this={orderForm} hidden>
		<input type="hidden" name="order" bind:this={orderInput} />
	</form>
	<ol class="flex flex-col gap-2" aria-label={t('hero.list')}>
		{#each data.rows as row, i (row.id)}
			<li
				draggable={sortable}
				ondragstart={() => (dragged = i)}
				ondragover={(e) => sortable && e.preventDefault()}
				ondrop={(e) => {
					e.preventDefault();
					drop(i);
				}}
				class={sortable ? 'cursor-grab' : ''}
			>
				<HeroCard
					{row}
					up={sortable && i > 0 ? swapped(i, i - 1) : undefined}
					down={sortable && i < ids.length - 1 ? swapped(i, i + 1) : undefined}
				/>
			</li>
		{/each}
	</ol>
{/if}
