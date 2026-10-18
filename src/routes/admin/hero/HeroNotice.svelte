<script lang="ts">
	import { t } from '#lib/i18n/index.svelte.ts';

	/* Answers of the hero actions: saved, the active limit, an archived block, a stale order. */
	type Props = { form: Record<string, unknown> | null | undefined; max: number };
	let { form, max }: Props = $props();
	const f = $derived(form ?? {});
</script>

{#if f.saved}
	<p role="status" class="mb-4 rounded-md bg-success-bg p-3 text-sm text-success-fg">
		{t('users.saved')}
	</p>
{:else if f.limit || f.badState || f.badOrder}
	<p role="alert" class="mb-4 rounded-md bg-error-bg p-3 text-sm text-error-fg">
		{#if f.limit}{t('hero.limit', { max })}
		{:else if f.badState}{t('hero.badState')}
		{:else}{t('hero.badOrder')}{/if}
	</p>
{/if}
