<script lang="ts" module>
	export type Prompt = 'link' | 'image' | 'video';
</script>

<script lang="ts">
	import Bold from '@lucide/svelte/icons/bold';
	import Heading2 from '@lucide/svelte/icons/heading-2';
	import Heading3 from '@lucide/svelte/icons/heading-3';
	import ImageIcon from '@lucide/svelte/icons/image';
	import Italic from '@lucide/svelte/icons/italic';
	import Link from '@lucide/svelte/icons/link';
	import List from '@lucide/svelte/icons/list';
	import ListOrdered from '@lucide/svelte/icons/list-ordered';
	import Quote from '@lucide/svelte/icons/quote';
	import Redo from '@lucide/svelte/icons/redo-2';
	import Undo from '@lucide/svelte/icons/undo-2';
	import Video from '@lucide/svelte/icons/video';
	import type { Editor } from '@tiptap/core';
	import type { Component } from 'svelte';
	import { t } from '#lib/i18n/index.svelte.ts';
	import type { MessageKey } from '#lib/i18n/translate.ts';

	type Props = { editor: Editor; tick: number; onprompt: (kind: Prompt) => void };
	let { editor, tick, onprompt }: Props = $props();

	type Tool = { label: MessageKey; icon: Component; run: () => void; active?: () => boolean };
	const chain = () => editor.chain().focus();
	const tools: Tool[] = [
		{
			label: 'editor.heading2',
			icon: Heading2,
			run: () => chain().toggleHeading({ level: 2 }).run(),
			active: () => editor.isActive('heading', { level: 2 })
		},
		{
			label: 'editor.heading3',
			icon: Heading3,
			run: () => chain().toggleHeading({ level: 3 }).run(),
			active: () => editor.isActive('heading', { level: 3 })
		},
		{
			label: 'editor.bold',
			icon: Bold,
			run: () => chain().toggleBold().run(),
			active: () => editor.isActive('bold')
		},
		{
			label: 'editor.italic',
			icon: Italic,
			run: () => chain().toggleItalic().run(),
			active: () => editor.isActive('italic')
		},
		{
			label: 'editor.bulletList',
			icon: List,
			run: () => chain().toggleBulletList().run(),
			active: () => editor.isActive('bulletList')
		},
		{
			label: 'editor.orderedList',
			icon: ListOrdered,
			run: () => chain().toggleOrderedList().run(),
			active: () => editor.isActive('orderedList')
		},
		{
			label: 'editor.quote',
			icon: Quote,
			run: () => chain().toggleBlockquote().run(),
			active: () => editor.isActive('blockquote')
		},
		{
			label: 'editor.link',
			icon: Link,
			run: () => onprompt('link'),
			active: () => editor.isActive('link')
		},
		{ label: 'editor.image', icon: ImageIcon, run: () => onprompt('image') },
		{ label: 'editor.video', icon: Video, run: () => onprompt('video') },
		{ label: 'editor.undo', icon: Undo, run: () => chain().undo().run() },
		{ label: 'editor.redo', icon: Redo, run: () => chain().redo().run() }
	];
	/** `tick` changes on every editor transaction: it re-reads the active marks. */
	function pressed(tool: Tool): boolean | undefined {
		void tick;
		return tool.active?.();
	}
</script>

<div
	role="toolbar"
	aria-label={t('editor.toolbar')}
	class="flex flex-wrap gap-1 border-b border-line bg-navy-50 p-1"
>
	{#each tools as tool (tool.label)}
		<button
			type="button"
			aria-label={t(tool.label)}
			title={t(tool.label)}
			aria-pressed={pressed(tool)}
			onclick={tool.run}
			class="inline-flex size-11 items-center justify-center rounded-sm text-ink-700 hover:bg-navy-100 focus-visible:outline-2 focus-visible:outline-navy-600 aria-pressed:bg-navy-700 aria-pressed:text-surface sm:size-9"
		>
			<tool.icon class="size-4" aria-hidden="true" />
		</button>
	{/each}
</div>
