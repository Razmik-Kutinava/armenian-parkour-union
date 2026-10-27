<script lang="ts">
	import Layers from '@lucide/svelte/icons/layers';
	import LocalizedInput from '#lib/components/admin/LocalizedInput.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import EmptyState from '#lib/components/ui/EmptyState.svelte';
	import { currentLocale, t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized } from '#lib/i18n/localized.ts';
	import TopicRow from './TopicRow.svelte';
	import type { PageProps } from './$types';

	/* docs/05 section 27 "Topics": add, rename, ↑ / ↓, hide / restore; counts in each row. */
	let { data, form }: PageProps = $props();
	const failed = $derived(form && 'errors' in form ? form : null);
	const shown = (errors: Partial<Record<string, MessageKey>> | undefined) =>
		Object.fromEntries(Object.entries(errors ?? {}).map(([k, v]) => [k, v && t(v)]));
	const forNew = $derived(failed && !failed.topicId ? failed : null);
</script>

<svelte:head>
	<title
		>{t('training.tab.topics')}: {pickLocalized(data.course.title, currentLocale())} — {t(
			'admin.title'
		)}</title
	>
</svelte:head>

<p class="mb-4 text-sm text-ink-700">{t('training.topics.hint')}</p>

{#if form && 'stateError' in form}
	<p role="alert" class="mb-4 rounded-md bg-error-bg p-3 text-sm text-error-fg">
		{t('training.error.topicState')}
	</p>
{:else if form && 'saved' in form}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t('users.saved')}
	</p>
{/if}

{#if data.topics.length === 0}
	<EmptyState icon={Layers} title={t('training.topics.empty')} />
{:else}
	<ol class="mb-8 flex flex-col gap-2">
		{#each data.topics as topic, i (topic.id)}
			<TopicRow
				{topic}
				first={i === 0}
				last={i === data.topics.length - 1}
				failed={failed?.topicId === topic.id
					? { values: failed.values, errors: shown(failed.errors) }
					: null}
			/>
		{/each}
	</ol>
{/if}

<form method="POST" action="?/create" class="flex flex-col gap-3 rounded-md border border-line p-4">
	{#key form}
		<LocalizedInput
			name="title"
			label={t('training.topics.title')}
			values={forNew?.values ?? {}}
			errors={shown(forNew?.errors)}
			required
		/>
	{/key}
	<div><Button type="submit">{t('training.topics.add')}</Button></div>
</form>
