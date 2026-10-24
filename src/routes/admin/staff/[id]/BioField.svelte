<script lang="ts">
	import Field from '#lib/components/ui/Field.svelte';
	import Tabs from '#lib/components/ui/Tabs.svelte';
	import { controlClass } from '#lib/components/ui/control.ts';
	import { t } from '#lib/i18n/index.svelte.ts';
	import { localeNames, locales, type Locale } from '#lib/i18n/locales.ts';
	import { STAFF_BIO_MAX } from '#lib/validation/staff-enums.ts';

	/* docs/05 section 1 item 4: EN / HY / RU tabs, plain text. All three stay in the form (inactive
	 * ones are only hidden), so one Save sends them; a tab with an error is marked. */
	type Props = {
		values: Record<string, string | undefined>;
		errors: Partial<Record<string, string>>;
	};
	let { values, errors }: Props = $props();
	const field = (locale: Locale) => `bio${locale[0].toUpperCase()}${locale.slice(1)}`;
	const tabs = $derived(
		locales.map((l) => ({ id: l, label: l.toUpperCase() + (errors[field(l)] ? ' !' : '') }))
	);
</script>

<Tabs {tabs} label={t('staff.form.bio')}>
	{#snippet panel(active)}
		{#each locales as locale (locale)}
			<div class:hidden={active !== locale}>
				<Field
					label="{t('staff.form.bio')} ({localeNames[locale]})"
					hint={t('staff.form.bioHint')}
					error={errors[field(locale)]}
				>
					{#snippet control({ id, describedBy, invalid })}
						<textarea
							{id}
							name={field(locale)}
							maxlength={STAFF_BIO_MAX}
							rows="5"
							aria-describedby={describedBy}
							aria-invalid={invalid || undefined}
							class="{controlClass} h-auto px-3 py-2">{values[field(locale)] ?? ''}</textarea
						>
					{/snippet}
				</Field>
			</div>
		{/each}
	{/snippet}
</Tabs>
