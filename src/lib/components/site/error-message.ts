import type { MessageKey } from '#lib/i18n/translate.ts';

export type ErrorContent =
	{ title: MessageKey; text: MessageKey } | { title: MessageKey; message: string };

const server: ErrorContent = { title: 'error.server.title', text: 'error.server.text' };

/** docs/06 section 9: a server error never shows its details; our own 4xx messages are safe to show. */
export function errorContent(status: number, message: string | undefined): ErrorContent {
	if (status === 404) return { title: 'error.notFound.title', text: 'error.notFound.text' };
	if (status === 403) return { title: 'error.forbidden.title', text: 'error.forbidden.text' };
	if (status >= 400 && status < 500 && message) return { title: 'error.request.title', message };
	return server;
}
