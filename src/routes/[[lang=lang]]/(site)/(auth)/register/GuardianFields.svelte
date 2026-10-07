<script lang="ts">
	import Input from '#lib/components/ui/Input.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';

	type Props = {
		values: Record<string, string> | undefined;
		error: (field: string) => string | undefined;
	};
	let { values, error }: Props = $props();
</script>

<fieldset class="flex flex-col gap-4 rounded-md border border-line p-4">
	<legend class="px-1 font-bold">{t('auth.guardian.title')}</legend>
	<p class="text-sm text-ink-700">{t('auth.guardian.hint')}</p>
	<Input
		label={t('auth.guardianName')}
		name="guardianName"
		autocomplete="off"
		required
		value={values?.guardianName ?? ''}
		error={error('guardianName')}
	/>
	<Input
		label={t('auth.guardianPhone')}
		name="guardianPhone"
		type="tel"
		autocomplete="off"
		required
		value={values?.guardianPhone ?? ''}
		error={error('guardianPhone')}
	/>
	<Input
		label={t('auth.guardianEmail')}
		name="guardianEmail"
		type="email"
		autocomplete="off"
		required
		value={values?.guardianEmail ?? ''}
		error={error('guardianEmail')}
	/>
</fieldset>
