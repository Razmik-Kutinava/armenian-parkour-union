<script lang="ts">
	import Button from '#lib/components/ui/Button.svelte';
	import { currentLocale, localizePath, t } from '#lib/i18n/index.svelte.ts';

	let { returnTo = '' }: { returnTo?: string } = $props();
</script>

<form method="POST" action={localizePath('/google', currentLocale())} class="flex flex-col">
	<input type="hidden" name="returnTo" value={returnTo} />
	<Button type="submit" variant="secondary">{t('auth.google.continue')}</Button>
</form>
<p class="my-4 text-center text-sm text-ink-700">{t('auth.google.or')}</p>
