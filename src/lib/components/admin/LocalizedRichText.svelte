<script lang="ts">
	import Tabs from '#lib/components/ui/Tabs.svelte';
	import { localeNames, locales } from '#lib/i18n/locales.ts';
	import RichTextEditor from './RichTextEditor.svelte';

	/* Like LocalizedInput: EN / HY / RU tabs, every editor stays in the form, a tab with an error is marked. */
	type Props = {
		name: string;
		label: string;
		values: Record<string, string | undefined>;
		errors?: Partial<Record<string, string>>;
	};
	let { name, label, values, errors = {} }: Props = $props();
	const field = (locale: string) => `${name}.${locale}`;
	const tabs = $derived(
		locales.map((l) => ({ id: l, label: l.toUpperCase() + (errors[field(l)] ? ' !' : '') }))
	);
</script>

<Tabs {tabs} {label}>
	{#snippet panel(active)}
		{#each locales as locale (locale)}
			<div class:hidden={active !== locale}>
				<RichTextEditor
					label="{label} ({localeNames[locale]})"
					name={field(locale)}
					value={values[field(locale)] ?? ''}
					error={errors[field(locale)]}
				/>
			</div>
		{/each}
	{/snippet}
</Tabs>
