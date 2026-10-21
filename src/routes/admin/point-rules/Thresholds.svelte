<script lang="ts">
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Checkbox from '#lib/components/ui/Checkbox.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';

	/* docs/03 section 6.4, decisions.md 2026-10-21: an entry is suspicious if any condition holds. */
	type Props = {
		values: Record<string, string>;
		form: { saved?: true; errors?: Partial<Record<string, MessageKey>> } | null | undefined;
		readonly: boolean;
	};
	let { values, form, readonly }: Props = $props();
	const errors = $derived(form?.errors ?? {});
	const field = (name: string, label: MessageKey) => ({
		name,
		label: t(label),
		value: values[name] ?? '',
		error: errors[name] && t(errors[name]),
		inputmode: 'numeric' as const,
		required: true,
		disabled: readonly
	});
</script>

<form method="POST" action="?/thresholds" class="mt-8 flex max-w-3xl flex-col gap-4" novalidate>
	{#if form?.saved}
		<p role="status" class="rounded-md bg-success-bg p-3 text-sm text-success-fg">
			{t('pointRules.th.saved')}
		</p>
	{:else if form?.errors}
		<p role="alert" class="rounded-md bg-error-bg p-3 text-sm text-error-fg">
			{t('settings.fixErrors')}
		</p>
	{/if}
	<FormSection title={t('pointRules.th.title')} text={t('pointRules.th.hint')}>
		<Checkbox
			label={t('pointRules.th.manual')}
			name="manual"
			checked={values.manual === 'on'}
			disabled={readonly}
		/>
		<div class="grid gap-4 sm:grid-cols-3">
			<Input {...field('minAmount', 'pointRules.th.minAmount')} />
			<Input {...field('burstCount', 'pointRules.th.burstCount')} />
			<Input {...field('burstHours', 'pointRules.th.burstHours')} />
		</div>
	</FormSection>
	{#if !readonly}<div><Button type="submit">{t('pointRules.th.save')}</Button></div>{/if}
</form>
