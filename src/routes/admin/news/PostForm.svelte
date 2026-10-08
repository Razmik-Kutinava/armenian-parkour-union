<script lang="ts">
	import FormLayout from '#lib/components/admin/FormLayout.svelte';
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import LocalizedInput from '#lib/components/admin/LocalizedInput.svelte';
	import LocalizedRichText from '#lib/components/admin/LocalizedRichText.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import type { PostStatus } from '#lib/validation/posts.ts';
	import CoverPicker from './CoverPicker.svelte';

	/* docs/05 section 18: title, address, excerpt, text ×3; cover, tags, status, date, author. */
	type Props = {
		action?: string;
		values: Record<string, string | undefined>;
		errors?: Partial<Record<string, MessageKey>>;
		authors: { id: string; name: string }[];
		images: { key: string; name: string; url: string | null }[];
	};
	let { action, values, errors = {}, authors, images }: Props = $props();
	const postStatuses: PostStatus[] = ['draft', 'published', 'archived'];
	const shown = $derived(
		Object.fromEntries(Object.entries(errors).map(([k, v]) => [k, v && t(v)]))
	);
</script>

<FormLayout {action} cancelHref="/admin/news" novalidate>
	<FormSection title={t('news.title')}>
		<Input
			label={t('news.slug')}
			name="slug"
			value={values.slug ?? ''}
			hint={t('news.slugHint')}
			error={shown.slug}
			required
		/>
		<LocalizedInput name="title" label={t('news.title')} {values} errors={shown} required />
		<LocalizedInput name="excerpt" label={t('news.excerpt')} {values} errors={shown} />
		<p class="-mt-2 text-sm text-ink-500">{t('news.excerptHint')}</p>
	</FormSection>
	<FormSection title={t('news.body')}>
		<LocalizedRichText name="body" label={t('news.body')} {values} errors={shown} />
	</FormSection>
	<FormSection title={t('news.status')}>
		<CoverPicker value={values.coverKey ?? ''} {images} error={shown.coverKey} />
		<Input
			label={t('news.tags')}
			name="tags"
			value={values.tags ?? ''}
			hint={t('news.tagsHint')}
			error={shown.tags}
		/>
		<Select
			label={t('news.status')}
			name="status"
			value={values.status ?? 'draft'}
			options={postStatuses.map((s) => ({ value: s, label: t(`pages.status.${s}`) }))}
			error={shown.status}
		/>
		<Input
			type="datetime-local"
			label={t('news.publishedAt')}
			name="publishedAt"
			value={values.publishedAt ?? ''}
			hint={t('news.publishedAtHint')}
			error={shown.publishedAt}
		/>
		<Select
			label={t('news.author')}
			name="authorId"
			value={values.authorId ?? ''}
			options={[{ value: '', label: '—' }, ...authors.map((a) => ({ value: a.id, label: a.name }))]}
			error={shown.authorId}
		/>
	</FormSection>
</FormLayout>
