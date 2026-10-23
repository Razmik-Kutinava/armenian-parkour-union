<script lang="ts">
	import Button from '#lib/components/ui/Button.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Select from '#lib/components/ui/Select.svelte';
	import { currentLocale, t } from '#lib/i18n/index.svelte.ts';
	import { pickLocalized, type LocalizedText } from '#lib/i18n/localized.ts';

	/* docs/05 section 5: add a member by hand; the server checks everything again. */
	let { categories }: { categories: { id: string; name: LocalizedText }[] } = $props();
	const options = $derived([
		{ value: '', label: t('registrationsAdmin.add.noCategory') },
		...categories.map((c) => ({ value: c.id, label: pickLocalized(c.name, currentLocale()) }))
	]);
</script>

<section class="mt-8 rounded-md border border-line bg-surface p-4">
	<h2 class="mb-3 text-lg font-bold">{t('registrationsAdmin.add.title')}</h2>
	<form method="POST" action="?/add" class="flex flex-wrap items-end gap-3">
		<div class="min-w-64 flex-1">
			<Input
				name="member"
				label={t('registrationsAdmin.add.member')}
				hint={t('registrationsAdmin.add.hint')}
				required
				maxlength={320}
				autocomplete="off"
			/>
		</div>
		{#if categories.length > 0}
			<div class="min-w-48">
				<Select name="categoryId" label={t('registrationsAdmin.col.category')} {options} value="" />
			</div>
		{/if}
		<Button type="submit">{t('registrationsAdmin.add.submit')}</Button>
	</form>
</section>
