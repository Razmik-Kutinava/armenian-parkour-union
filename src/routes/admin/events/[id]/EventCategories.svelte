<script lang="ts">
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import LocalizedInput from '#lib/components/admin/LocalizedInput.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { currentLocale, t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import type { EventCategory } from '#lib/server/services/events/categories.ts';
	import { disciplines } from '#lib/validation/event-enums.ts';
	import { flattenValues } from '#lib/validation/site-settings-form.ts';
	import { ageLabel } from '#lib/components/site/event-age.ts';

	/* docs/05 section 5, tab "Categories": name ×3, discipline, age from / to, limit, order. */
	type Props = {
		categories: EventCategory[];
		/** Which form failed: 'new' or a category id. */
		failed?: string;
		errors?: Partial<Record<string, MessageKey>>;
	};
	let { categories, failed, errors = {} }: Props = $props();
	const shown = (id: string) =>
		failed === id ? Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v && t(v)])) : {};
	const disciplineOptions = $derived(
		disciplines.map((d) => ({ value: d, label: t(`events.discipline.${d}`) }))
	);
	const valuesOf = (c: EventCategory) => ({
		...flattenValues({ name: c.name }),
		discipline: c.discipline,
		ageMin: c.ageMin === null ? '' : String(c.ageMin),
		ageMax: c.ageMax === null ? '' : String(c.ageMax),
		capacity: c.capacity === null ? '' : String(c.capacity),
		sortOrder: String(c.sortOrder)
	});
</script>

{#snippet fields(values: Record<string, string>, err: Record<string, string | undefined>)}
	<LocalizedInput name="name" label={t('events.categoryName')} {values} errors={err} required />
	<div class="grid gap-4 sm:grid-cols-2">
		<Select
			label={t('events.discipline')}
			name="discipline"
			value={values.discipline ?? 'other'}
			options={disciplineOptions}
			error={err.discipline}
		/>
		<Input
			label={t('events.sortOrder')}
			name="sortOrder"
			inputmode="numeric"
			value={values.sortOrder ?? '0'}
			error={err.sortOrder}
		/>
	</div>
	<div class="grid gap-4 sm:grid-cols-3">
		<Input
			label={t('events.ageMin')}
			name="ageMin"
			inputmode="numeric"
			value={values.ageMin ?? ''}
			error={err.ageMin}
		/>
		<Input
			label={t('events.ageMax')}
			name="ageMax"
			inputmode="numeric"
			value={values.ageMax ?? ''}
			error={err.ageMax}
		/>
		<Input
			label={t('events.categoryCapacity')}
			name="capacity"
			inputmode="numeric"
			value={values.capacity ?? ''}
			error={err.capacity}
		/>
	</div>
{/snippet}

<FormSection title={t('events.categories')}>
	{#if categories.length === 0}
		<p class="text-sm text-ink-700">{t('events.categoriesEmpty')}</p>
	{:else}
		<ul class="flex flex-col divide-y divide-line rounded-md border border-line">
			{#each categories as category (category.id)}
				<li class="flex flex-col gap-3 p-3">
					<div class="flex flex-wrap items-center justify-between gap-2">
						<p class="text-sm">
							<span class="font-bold">{pickLocalized(category.name, currentLocale())}</span>
							· {t(`events.discipline.${category.discipline}`)}
							{#if ageLabel(category)}· {ageLabel(category)}{/if}
							{#if category.capacity !== null}· {t('events.placesLimit', {
									capacity: category.capacity
								})}{/if}
						</p>
						<form method="POST" action="?/categoryDelete">
							<input type="hidden" name="categoryId" value={category.id} />
							<Button type="submit" variant="ghost" size="sm">{t('events.categoryRemove')}</Button>
						</form>
					</div>
					<details open={failed === category.id}>
						<summary class="cursor-pointer text-sm text-navy-700"
							>{t('events.categoryEdit')}</summary
						>
						<form method="POST" action="?/categoryUpdate" class="mt-3 flex flex-col gap-4">
							<input type="hidden" name="categoryId" value={category.id} />
							{@render fields(valuesOf(category), shown(category.id))}
							<div><Button type="submit" size="sm">{t('events.categoryUpdate')}</Button></div>
						</form>
					</details>
				</li>
			{/each}
		</ul>
	{/if}
	<form method="POST" action="?/categoryCreate" class="flex flex-col gap-4">
		{@render fields({}, shown('new'))}
		<div><Button type="submit" variant="secondary">{t('events.categoryAdd')}</Button></div>
	</form>
</FormSection>
