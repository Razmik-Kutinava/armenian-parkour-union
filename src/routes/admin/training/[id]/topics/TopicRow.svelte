<script lang="ts">
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import LocalizedInput from '#lib/components/admin/LocalizedInput.svelte';
	import Badge from '#lib/components/ui/Badge.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { flattenValues } from '#lib/validation/site-settings-form.ts';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickPortal, type PortalText } from '#lib/i18n/localized.ts';

	type Props = {
		topic: {
			id: string;
			title: unknown;
			hiddenAt: Date | null;
			lessons: number;
			questions: number;
		};
		first: boolean;
		last: boolean;
		/** The rename of this topic came back with errors. */
		failed: { values: Record<string, string>; errors: Record<string, string | undefined> } | null;
	};
	let { topic, first, last, failed }: Props = $props();
	const title = $derived(pickPortal(topic.title as PortalText, currentLocale()));
	const values = $derived(failed?.values ?? flattenValues({ title: topic.title }));
</script>

{#snippet action(name: string, label: string)}
	<form method="POST" action="?/{name}">
		<input type="hidden" name="topicId" value={topic.id} />
		<Button type="submit" variant="secondary" size="sm">{label}</Button>
	</form>
{/snippet}
{#snippet move(direction: 'up' | 'down', label: string)}
	<form method="POST" action="?/move">
		<input type="hidden" name="topicId" value={topic.id} />
		<input type="hidden" name="direction" value={direction} />
		<Button type="submit" variant="ghost" size="sm" aria-label={label}>
			{#if direction === 'up'}<ArrowUp class="size-4" aria-hidden="true" />
			{:else}<ArrowDown class="size-4" aria-hidden="true" />{/if}
		</Button>
	</form>
{/snippet}

<li class="rounded-md border border-line p-3" class:bg-bg={topic.hiddenAt}>
	<div class="flex flex-wrap items-center gap-3">
		<span class="font-bold">{title}</span>
		{#if topic.hiddenAt}<Badge tone="warning">{t('training.topics.hidden')}</Badge>{/if}
		<span class="text-sm text-ink-700">
			{t('training.topics.counts', { lessons: topic.lessons, questions: topic.questions })}
		</span>
		<div class="ml-auto flex flex-wrap gap-2">
			{#if !first}{@render move('up', t('training.topics.up'))}{/if}
			{#if !last}{@render move('down', t('training.topics.down'))}{/if}
			{#if topic.hiddenAt}
				{@render action('restore', t('training.topics.restore'))}
			{:else}
				{@render action('hide', t('training.topics.hide'))}
			{/if}
		</div>
	</div>
	<details class="mt-2" open={!!failed}>
		<summary class="cursor-pointer text-sm font-bold text-navy-700">
			{t('training.topics.rename')}
		</summary>
		<form method="POST" action="?/update" class="mt-2 flex flex-col gap-3">
			<input type="hidden" name="topicId" value={topic.id} />
			<LocalizedInput
				name="title"
				label={t('training.topics.title')}
				{values}
				errors={failed?.errors}
			/>
			<div><Button type="submit" size="sm">{t('training.topics.save')}</Button></div>
		</form>
	</details>
</li>
