<script lang="ts">
	import LocalizedInput from '#lib/components/admin/LocalizedInput.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';

	/* Footer links (decisions.md 2026-10-08, 2.7): numbered rows, the server drops empty ones. */
	type Props = {
		values: Record<string, string | undefined>;
		errors: Partial<Record<string, string>>;
	};
	let { values, errors }: Props = $props();
	const MAX = 10;

	function savedRows(v: Record<string, string | undefined>): number[] {
		const ids = Object.keys(v).flatMap((k) => k.match(/^footer\.links\.(\d+)\./)?.[1] ?? []);
		const count = ids.length ? Math.max(...ids.map(Number)) + 1 : 0;
		return Array.from({ length: Math.min(count + 1, MAX) }, (_, i) => i);
	}
	/* Reset after every submit: the server renumbers rows. */
	let rows = $derived(savedRows(values));
	const name = (id: number, field: string) => `footer.links.${id}.${field}`;
</script>

{#if errors['footer.links']}
	<p role="alert" class="text-sm text-error-fg">{errors['footer.links']}</p>
{/if}
{#each rows as id, n (id)}
	<div class="flex flex-col gap-3 rounded-md border border-line p-3">
		<LocalizedInput
			name={name(id, 'label')}
			label="{t('settings.linkLabel')} {n + 1}"
			{values}
			{errors}
		/>
		<Input
			label="{t('settings.linkUrl')} {n + 1}"
			name={name(id, 'url')}
			value={values[name(id, 'url')] ?? ''}
			error={errors[name(id, 'url')]}
		/>
		<Button
			variant="ghost"
			size="sm"
			class="self-start"
			onclick={() => (rows = rows.filter((r) => r !== id))}>{t('settings.removeLink')}</Button
		>
	</div>
{/each}
{#if rows.length < MAX}
	<Button
		variant="secondary"
		class="self-start"
		onclick={() => (rows = [...rows, Math.max(-1, ...rows) + 1])}>{t('settings.addLink')}</Button
	>
{/if}
