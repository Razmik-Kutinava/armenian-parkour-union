<script lang="ts">
	import Button from '#lib/components/ui/Button.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';

	/* decisions.md 2026-10-08 (2.6): search by name among adult members; only id, name, avatar. */
	type Person = { id: string; name: string };
	let { value, name, error }: { value: string; name: string; error?: string } = $props();

	let query = $state('');
	let found: Person[] | null = $state(null);
	let picked: Person | null = $state(null);
	const chosen = $derived(picked ?? (value ? { id: value, name } : null));

	async function search() {
		const res = await fetch(`/admin/hero/persons?q=${encodeURIComponent(query)}`);
		found = res.ok ? await res.json() : [];
	}
</script>

<div class="flex flex-col gap-2" role="group" aria-label={t('hero.form.person')}>
	<input type="hidden" name="personUserId" value={chosen?.id ?? ''} />
	<input type="hidden" name="personName" value={chosen?.name ?? ''} />
	<div class="flex items-end gap-2">
		<Input
			label={t('hero.form.personSearch')}
			hint={t('hero.form.personHint')}
			bind:value={query}
			onkeydown={(e) => {
				if (e.key !== 'Enter') return;
				e.preventDefault();
				search();
			}}
		/>
		<Button variant="secondary" onclick={search}>{t('hero.form.personFind')}</Button>
	</div>
	{#if chosen}
		<p class="font-bold text-ink-900">{t('hero.form.personChosen', { name: chosen.name })}</p>
	{/if}
	{#if found && found.length === 0}<p class="text-sm text-ink-700">
			{t('hero.form.personNone')}
		</p>{/if}
	{#if found?.length}
		<ul class="flex flex-wrap gap-2">
			{#each found as person (person.id)}
				<li>
					<Button
						variant="ghost"
						size="sm"
						onclick={() => {
							picked = person;
							found = null;
						}}>{person.name}</Button
					>
				</li>
			{/each}
		</ul>
	{/if}
	{#if error}<p class="text-sm text-error-fg">{error}</p>{/if}
</div>
