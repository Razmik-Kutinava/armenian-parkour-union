<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '#lib/components/ui/Button.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';

	/* docs/06 section 4.3: the category (only those the age fits) and "Register"; no seat in the
	 * chosen one — "Join the waitlist". The service decides the status again on submit. */
	type Option = { id: string; name: string; full: boolean };
	let { options, full }: { options: Option[]; full: boolean } = $props();
	let picked = $state<string | null>(null);
	const categoryId = $derived(picked ?? options.find((o) => !o.full)?.id ?? options[0]?.id ?? '');
	let submitting = $state(false);
	const waitlist = $derived(
		options.length > 0 ? (options.find((o) => o.id === categoryId)?.full ?? full) : full
	);
</script>

<form
	method="POST"
	action="?/register"
	class="flex flex-col gap-3"
	use:enhance={() => {
		submitting = true;
		return async ({ update }) => {
			await update();
			submitting = false;
		};
	}}
>
	{#if options.length > 0}
		<Select
			name="categoryId"
			label={t('registrations.category')}
			required
			value={categoryId}
			onchange={(e) => (picked = e.currentTarget.value)}
			options={options.map((o) => ({
				value: o.id,
				label: o.full ? t('registrations.categoryFull', { name: o.name }) : o.name
			}))}
		/>
	{/if}
	<Button type="submit" loading={submitting}>
		{t(waitlist ? 'registrations.submitWaitlist' : 'registrations.submit')}
	</Button>
</form>
