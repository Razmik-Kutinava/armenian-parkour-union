<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '#lib/components/ui/Button.svelte';
	import Checkbox from '#lib/components/ui/Checkbox.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import FormMessage from '../../(auth)/FormMessage.svelte';

	/* docs/06 section 5.2 "Privacy": both are off until the member turns them on. */
	type Props = { showCity: boolean; showAvatar: boolean; saved: boolean };
	let { showCity, showAvatar, saved }: Props = $props();
</script>

<form
	method="POST"
	action="?/privacy"
	class="flex flex-col gap-4 border-t border-line pt-6"
	use:enhance={() =>
		({ update }) =>
			update({ reset: false })}
>
	<h2 class="text-xl font-bold text-ink-900">{t('cabinet.privacy.title')}</h2>
	<p class="text-ink-700">{t('cabinet.privacy.hint')}</p>
	{#if saved}<FormMessage tone="success" text={t('cabinet.privacy.saved')} />{/if}
	<Checkbox name="showCity" checked={showCity} label={t('cabinet.privacy.showCity')} />
	<Checkbox name="showAvatar" checked={showAvatar} label={t('cabinet.privacy.showAvatar')} />
	<Button type="submit" class="w-fit">{t('cabinet.privacy.submit')}</Button>
</form>
