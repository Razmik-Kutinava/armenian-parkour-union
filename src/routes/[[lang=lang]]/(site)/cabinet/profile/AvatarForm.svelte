<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import Avatar from '#lib/components/site/Avatar.svelte';
	import Button from '#lib/components/ui/Button.svelte';
	import { t, type MessageKey } from '#lib/i18n/index.svelte.ts';
	import { avatarMimes } from '#lib/validation/avatar.ts';
	import FormMessage from '../../(auth)/FormMessage.svelte';
	import { uploadAvatar } from './upload-avatar';

	/* docs/06 section 5.2 "photo": the file goes straight to the bucket, the server checks it. */
	type Props = {
		name: string;
		/** `null` also when a photo is set but the bucket address is not configured. */
		url: string | null;
		hasPhoto: boolean;
		result: { message?: MessageKey } | undefined;
	};
	let { name, url, hasPhoto, result }: Props = $props();

	let uploading = $state(false);
	let local = $state<MessageKey | null>(null);
	const shown = $derived(local ?? result?.message ?? null);
	const ok = (message: MessageKey) =>
		message === 'cabinet.avatar.saved' || message === 'cabinet.avatar.removed';

	async function pick(input: HTMLInputElement) {
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		uploading = true;
		local = null;
		const error = await uploadAvatar(file).catch((): MessageKey => 'cabinet.avatar.failed');
		uploading = false;
		local = error ?? 'cabinet.avatar.saved';
		if (!error) await invalidateAll();
	}
</script>

<section class="flex flex-col gap-4" aria-labelledby="avatar-title">
	<h2 id="avatar-title" class="text-xl font-bold text-ink-900">{t('cabinet.avatar.title')}</h2>
	<div class="flex flex-wrap items-center gap-4">
		<Avatar {name} {url} alt={t('cabinet.avatar.alt')} class="size-24 text-2xl" />
		<div class="flex flex-wrap gap-2">
			<label
				class="inline-flex min-h-11 cursor-pointer items-center rounded-md border border-navy-700 px-4 font-bold text-navy-700 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-navy-600 hover:bg-navy-100 sm:min-h-10"
				aria-busy={uploading || undefined}
			>
				{uploading
					? t('cabinet.avatar.uploading')
					: t(hasPhoto ? 'cabinet.avatar.change' : 'cabinet.avatar.upload')}
				<input
					type="file"
					accept={avatarMimes.join(',')}
					class="sr-only"
					disabled={uploading}
					onchange={(e) => pick(e.currentTarget)}
				/>
			</label>
			{#if hasPhoto}
				<form
					method="POST"
					action="?/avatarRemove"
					use:enhance={() => {
						local = null;
						return ({ update }) => update({ reset: false });
					}}
				>
					<Button type="submit" variant="ghost">{t('cabinet.avatar.remove')}</Button>
				</form>
			{/if}
		</div>
	</div>
	<p class="text-sm text-ink-700">{t('cabinet.avatar.hint')}</p>
	{#if shown}
		<FormMessage tone={ok(shown) ? 'success' : 'error'} text={t(shown)} />
	{/if}
</section>
