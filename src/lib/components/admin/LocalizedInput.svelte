<script lang="ts">
	import Input from '#lib/components/ui/Input.svelte';
	import Tabs from '#lib/components/ui/Tabs.svelte';
	import { localeNames, locales } from '#lib/i18n/locales.ts';

	/*
	 * docs/05 section 1 item 4: EN / HY / RU tabs, English required. Every language stays in the form
	 * (inactive ones are only hidden), so one Save sends all three; a tab with an error is marked.
	 */
	type Props = {
		name: string;
		label: string;
		values: Record<string, string | undefined>;
		errors?: Partial<Record<string, string>>;
		/** English is required for the whole value; otherwise the field may stay empty. */
		required?: boolean;
	};
	let { name, label, values, errors = {}, required = false }: Props = $props();
	const field = (locale: string) => `${name}.${locale}`;
	const tabs = $derived(
		locales.map((l) => ({ id: l, label: l.toUpperCase() + (errors[field(l)] ? ' !' : '') }))
	);
</script>

<Tabs {tabs} {label}>
	{#snippet panel(active)}
		{#each locales as locale (locale)}
			<div class:hidden={active !== locale}>
				<Input
					label="{label} ({localeNames[locale]})"
					name={field(locale)}
					required={required && locale === 'en'}
					value={values[field(locale)] ?? ''}
					error={errors[field(locale)]}
				/>
			</div>
		{/each}
	{/snippet}
</Tabs>
