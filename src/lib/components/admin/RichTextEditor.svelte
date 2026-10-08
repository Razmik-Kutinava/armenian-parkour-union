<script lang="ts">
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import { Editor } from '@tiptap/core';
	import { onMount } from 'svelte';
	import RichTextDialog from './RichTextDialog.svelte';
	import RichTextToolbar, { type Prompt } from './RichTextToolbar.svelte';
	import { richTextExtensions } from './rich-text-extensions';

	/*
	 * docs/05 section 18. The HTML goes to the form in a hidden field; the server cleans it on save
	 * (server/rich-text/schema.ts), so nothing typed or pasted here is trusted.
	 */
	type Props = { name: string; label: string; value?: string; error?: string };
	let { name, label, value = '', error }: Props = $props();

	const id = $props.id();
	let element: HTMLDivElement | undefined = $state();
	let editor: Editor | undefined = $state();
	let html = $state('');
	let tick = $state(0);
	let prompt: Prompt | null = $state(null);

	onMount(() => {
		html = value.trim();
		const instance = new Editor({
			element,
			extensions: richTextExtensions(),
			content: value,
			editorProps: {
				attributes: {
					role: 'textbox',
					'aria-multiline': 'true',
					'aria-labelledby': `${id}-label`,
					...(error ? { 'aria-describedby': `${id}-error`, 'aria-invalid': 'true' } : {}),
					class: 'rich-text min-h-48 px-3 py-2 focus:outline-none'
				}
			},
			onTransaction: () => tick++,
			onUpdate: ({ editor: e }) => (html = e.isEmpty ? '' : e.getHTML())
		});
		editor = instance;
		return () => instance.destroy();
	});
</script>

<div class="flex flex-col gap-1">
	<span id="{id}-label" class="text-sm font-bold text-ink-900">{label}</span>
	<div
		class="overflow-hidden rounded-sm border bg-surface focus-within:border-navy-600 focus-within:outline-2 focus-within:outline-navy-600 {error
			? 'border-error-fg'
			: 'border-line'}"
	>
		{#if editor}
			<RichTextToolbar {editor} {tick} onprompt={(kind) => (prompt = kind)} />
		{/if}
		<div bind:this={element}></div>
	</div>
	<input type="hidden" {name} value={editor ? html : value} />
	{#if error}
		<p id="{id}-error" class="flex items-center gap-1 text-sm text-error-fg">
			<CircleAlert class="size-4 shrink-0" aria-hidden="true" />{error}
		</p>
	{/if}
</div>
{#if editor}
	<RichTextDialog {editor} bind:kind={prompt} />
{/if}
