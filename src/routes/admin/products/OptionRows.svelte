<script lang="ts">
	import Button from '#lib/components/ui/Button.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { ITEM_OPTIONS_MAX } from '#lib/validation/shop-limits.ts';

	/* docs/05 section 14: options (size, colour) with their values; an empty row is left out. */
	let {
		values,
		errors
	}: { values: Record<string, string | undefined>; errors: Record<string, string | undefined> } =
		$props();

	const filled = $derived(
		Array.from({ length: ITEM_OPTIONS_MAX }, (_, i) => i).filter(
			(i) => values[`options.${i}.name`] || values[`options.${i}.values`]
		).length
	);
	let added = $state(0);
	const rows = $derived(Math.min(ITEM_OPTIONS_MAX, Math.max(filled + 1, 1) + added));
</script>

<p class="text-sm text-ink-500">{t('shop.item.optionsHint')}</p>
{#each Array.from({ length: rows }, (_, i) => i) as i (i)}
	<div class="grid gap-4 sm:grid-cols-[1fr_2fr]">
		<Input
			label={t('shop.item.option', { n: i + 1 })}
			name="options.{i}.name"
			value={values[`options.${i}.name`] ?? ''}
			error={errors[`options.${i}.name`]}
			maxlength={40}
		/>
		<Input
			label={t('shop.item.optionValues', { n: i + 1 })}
			name="options.{i}.values"
			value={values[`options.${i}.values`] ?? ''}
			error={errors[`options.${i}.values`]}
		/>
	</div>
{/each}
{#if rows < ITEM_OPTIONS_MAX}
	<div>
		<Button variant="ghost" size="sm" onclick={() => (added += 1)}
			>{t('shop.item.optionAdd')}</Button
		>
	</div>
{/if}
{#if errors.options}<p class="text-sm text-error-fg">{errors.options}</p>{/if}
