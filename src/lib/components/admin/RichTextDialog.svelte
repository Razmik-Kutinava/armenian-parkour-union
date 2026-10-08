<script lang="ts">
	import type { Editor } from '@tiptap/core';
	import { isValidYoutubeUrl } from '@tiptap/extension-youtube';
	import Button from '#lib/components/ui/Button.svelte';
	import Input from '#lib/components/ui/Input.svelte';
	import Modal from '#lib/components/ui/Modal.svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { Prompt } from './RichTextToolbar.svelte';

	/* Inputs have no `name` and Enter is caught: the dialog sits inside the page form. */
	let { editor, kind = $bindable() }: { editor: Editor; kind: Prompt | null } = $props();

	let url = $state('');
	let alt = $state('');
	let error = $state<string>();
	let open = $state(false);

	$effect(() => {
		if (!kind) return;
		url = kind === 'link' ? (editor.getAttributes('link').href ?? '') : '';
		alt = '';
		error = undefined;
		open = true;
	});
	$effect(() => {
		if (!open) kind = null;
	});

	const titles = { link: 'editor.link', image: 'editor.image', video: 'editor.video' } as const;
	const hints = {
		link: 'editor.linkHint',
		image: 'editor.imageHint',
		video: 'editor.videoHint'
	} as const;

	function apply() {
		const value = url.trim();
		const chain = editor.chain().focus();
		if (kind === 'link') {
			if (value) chain.extendMarkRange('link').setLink({ href: value }).run();
			else chain.extendMarkRange('link').unsetLink().run();
		} else if (kind === 'image' && value) {
			chain.setImage({ src: value, alt: alt.trim() }).run();
		} else if (kind === 'video' && value) {
			if (!isValidYoutubeUrl(value)) return void (error = t('editor.badVideo'));
			chain.setYoutubeVideo({ src: value }).run();
		}
		open = false;
	}
	const onkeydown = (e: KeyboardEvent) => {
		if (e.key !== 'Enter') return;
		e.preventDefault();
		apply();
	};
</script>

<Modal bind:open title={kind ? t(titles[kind]) : ''}>
	{#if kind}
		<div class="flex flex-col gap-4">
			<Input label={t('editor.url')} hint={t(hints[kind])} {error} bind:value={url} {onkeydown} />
			{#if kind === 'image'}
				<Input label={t('editor.alt')} hint={t('media.altHint')} bind:value={alt} {onkeydown} />
			{/if}
		</div>
	{/if}
	{#snippet footer()}
		{#if kind === 'link' && editor.isActive('link')}
			<Button
				variant="ghost"
				onclick={() => {
					url = '';
					apply();
				}}>{t('editor.remove')}</Button
			>
		{/if}
		<Button onclick={apply}>{t('editor.insert')}</Button>
	{/snippet}
</Modal>
