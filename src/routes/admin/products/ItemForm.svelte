<script lang="ts">
	import FormLayout from '#lib/components/admin/FormLayout.svelte';
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import LocalizedInput from '#lib/components/admin/LocalizedInput.svelte';
	import LocalizedRichText from '#lib/components/admin/LocalizedRichText.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { ITEM_IMAGES_MAX, itemFormStatuses } from '#lib/validation/shop-limits.ts';
	import ImageList from './ImageList.svelte';
	import OptionRows from './OptionRows.svelte';

	/* docs/05 section 14: title and description ×3, photos, price, options, stock, status, order. */
	type Props = {
		action?: string;
		values: Record<string, string | undefined>;
		errors?: Partial<Record<string, MessageKey>>;
		images: { key: string; name: string; url: string | null }[];
		/** Archived: the status is changed only by its buttons. */
		statusLocked?: boolean;
	};
	let { action, values, errors = {}, images, statusLocked = false }: Props = $props();
	const shown = $derived(
		Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v && t(v)]))
	);
	const field = (name: string) => ({ name, value: values[name] ?? '', error: shown[name] });
	const imageKeys = $derived(
		Array.from({ length: ITEM_IMAGES_MAX }, (_, i) => values[`imageKeys.${i}`]).filter(
			(k): k is string => !!k
		)
	);
	const imageError = $derived(
		Object.entries(shown).find(([k]) => k === 'imageKeys' || k.startsWith('imageKeys.'))?.[1]
	);
</script>

<FormLayout {action} cancelHref="/admin/products" novalidate>
	<FormSection title={t('shop.item.section.main')}>
		<Input label={t('shop.item.slug')} hint={t('shop.item.slugHint')} required {...field('slug')} />
		<LocalizedInput name="title" label={t('shop.item.title')} {values} errors={shown} required />
		<LocalizedRichText
			name="description"
			label={t('shop.item.description')}
			{values}
			errors={shown}
		/>
		<ImageList initial={imageKeys} {images} error={imageError} />
	</FormSection>
	<FormSection title={t('shop.item.section.sale')}>
		<div class="grid gap-4 sm:grid-cols-2">
			<Input label={t('shop.item.price')} inputmode="numeric" required {...field('pricePoints')} />
			<Input
				label={t('shop.item.stock')}
				hint={t('shop.item.stockHint')}
				inputmode="numeric"
				{...field('stock')}
			/>
		</div>
	</FormSection>
	<FormSection title={t('shop.item.section.options')}>
		<OptionRows {values} errors={shown} />
	</FormSection>
	<FormSection title={t('shop.item.section.publication')}>
		{#if statusLocked}
			<input type="hidden" name="status" value="draft" />
		{:else}
			<Select
				label={t('pages.status')}
				name="status"
				value={values.status ?? 'draft'}
				options={itemFormStatuses.map((s) => ({ value: s, label: t(`shop.item.status.${s}`) }))}
				error={shown.status}
			/>
		{/if}
		<Input
			label={t('shop.item.sortOrder')}
			hint={t('shop.item.sortOrderHint')}
			inputmode="numeric"
			{...field('sortOrder')}
			value={values.sortOrder ?? '0'}
		/>
	</FormSection>
</FormLayout>
