<script lang="ts">
	import FormSection from '#lib/components/admin/FormSection.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { MessageKey } from '#lib/i18n/translate.ts';
	import { isMinor } from '#lib/validation/auth.ts';

	/* docs/05 section 6: profile fields of the admin forms; parent data only under 18 (docs/03 section 13). */
	type Props = {
		values: Record<string, string | null | undefined>;
		errors?: Partial<Record<string, MessageKey>>;
		withEmail?: boolean;
	};
	let { values, errors = {}, withEmail = false }: Props = $props();

	let birthDate = $derived(values.birthDate ?? '');
	const minor = $derived(isMinor(birthDate, new Date()));
	const err = (field: string) => {
		const key = errors[field];
		return key ? t(key) : undefined;
	};
	const v = (field: string) => values[field] ?? '';
</script>

<FormSection title={t('users.section.main')}>
	{#if withEmail}
		<Input
			label={t('auth.email')}
			name="email"
			type="email"
			required
			value={v('email')}
			error={err('email')}
		/>
	{/if}
	<div class="grid gap-4 sm:grid-cols-2">
		<Input
			label={t('auth.firstName')}
			name="firstName"
			required
			value={v('firstName')}
			error={err('firstName')}
		/>
		<Input
			label={t('auth.lastName')}
			name="lastName"
			required
			value={v('lastName')}
			error={err('lastName')}
		/>
	</div>
	<Input
		label={t('auth.birthDate')}
		name="birthDate"
		type="date"
		required
		bind:value={birthDate}
		error={err('birthDate')}
	/>
	<div class="grid gap-4 sm:grid-cols-2">
		<Input
			label={t('users.phone')}
			name="phone"
			type="tel"
			value={v('phone')}
			error={err('phone')}
		/>
		<Input label={t('users.filter.city')} name="city" value={v('city')} error={err('city')} />
	</div>
</FormSection>

{#if minor}
	<FormSection title={t('auth.guardian.title')} text={t('auth.guardian.hint')}>
		<Input
			label={t('auth.guardianName')}
			name="guardianName"
			required
			value={v('guardianName')}
			error={err('guardianName')}
		/>
		<Input
			label={t('auth.guardianPhone')}
			name="guardianPhone"
			type="tel"
			required
			value={v('guardianPhone')}
			error={err('guardianPhone')}
		/>
		<Input
			label={t('auth.guardianEmail')}
			name="guardianEmail"
			type="email"
			required
			value={v('guardianEmail')}
			error={err('guardianEmail')}
		/>
	</FormSection>
{/if}
