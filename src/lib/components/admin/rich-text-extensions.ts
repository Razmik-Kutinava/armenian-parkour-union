import type { Extensions } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import Youtube from '@tiptap/extension-youtube';
import StarterKit from '@tiptap/starter-kit';

/*
 * Only what docs/05 section 18 lists. The server cleans by the same set
 * (server/rich-text/sanitize.ts): a format added here and not there is lost on save.
 */
export const richTextExtensions = (): Extensions => [
	StarterKit.configure({
		heading: { levels: [2, 3] },
		code: false,
		codeBlock: false,
		strike: false,
		underline: false,
		horizontalRule: false,
		link: {
			openOnClick: false,
			defaultProtocol: 'https',
			protocols: ['mailto'],
			HTMLAttributes: { rel: 'noopener noreferrer', target: null }
		}
	}),
	Image.configure({ allowBase64: false }),
	Youtube.configure({ nocookie: true, width: 640, height: 360 })
];
