import type { Breadcrumb, ErrorEvent, init } from '@sentry/sveltekit';

type Options = NonNullable<Parameters<typeof init>[0]>;

/* Members include minors (docs/03, section 13): no user, cookies, bodies, query or variables. */
export const dataCollection: Options['dataCollection'] = {
	userInfo: false,
	cookies: false,
	httpHeaders: { request: { allow: ['user-agent', 'referer'] }, response: false },
	httpBodies: [],
	urlQueryParams: false,
	databaseQueryData: false,
	stackFrameVariables: false
};

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;

export const scrubEmails = (text: string) => text.replace(EMAIL, '[email]');

const scrubArgument = (value: unknown) => scrubEmails(String(value));

/* A console line arrives as a nameless synthetic exception, and Sentry titles a synthetic one by
 * its function (`POST`): give it a type and drop the flag, so the title is the logged text. */
function nameConsoleCapture(event: ErrorEvent) {
	if (event.logger !== 'console') return;
	for (const exception of event.exception?.values ?? []) {
		if (!exception.mechanism?.synthetic) continue;
		exception.mechanism.synthetic = false;
		exception.type = event.level === 'warning' ? 'Warning' : 'Error';
	}
}

/* A wrong email or password is the user's mistake, yet Better Auth logs it with console.warn. */
const SIGN_IN_MISTAKES = ['Invalid password', 'User not found', 'Password not found'];

function isSignInMistake(event: ErrorEvent) {
	const texts = [event.message, ...(event.exception?.values ?? []).map((e) => e.value)];
	return texts.some(
		(text) =>
			text?.includes('[Better Auth]') &&
			SIGN_IN_MISTAKES.some((mistake) => text.trimEnd().endsWith(mistake))
	);
}

/* The visitor's network, not the site: a browser fetch that never got a response (the SDK adds the
 * host in brackets), or a client that closed the connection before the server read the request. */
const BROWSER_OFFLINE =
	/^(Failed to fetch|NetworkError when attempting to fetch resource\.|Load failed)( \(.+\))?$/;

function isDroppedConnection(event: ErrorEvent) {
	return (event.exception?.values ?? []).some(
		({ type, value = '' }) =>
			(type === 'TypeError' && BROWSER_OFFLINE.test(value)) ||
			(type === 'Error' && value === 'aborted')
	);
}

/** Chromium, Firefox and Safari wording for a code chunk that failed to load. */
export function isMissingChunk(error: unknown) {
	const message = error instanceof Error ? error.message : '';
	return /dynamically imported module|Importing a module script failed/.test(message);
}

/** Log lines name letter recipients (`certificate letter to a@b.c not sent`). */
export function scrubEvent(event: ErrorEvent): ErrorEvent | null {
	if (isSignInMistake(event) || isDroppedConnection(event)) return null;
	nameConsoleCapture(event);
	if (event.message) event.message = scrubEmails(event.message);
	for (const exception of event.exception?.values ?? []) {
		if (exception.value) exception.value = scrubEmails(exception.value);
	}
	const args = event.extra?.arguments;
	if (Array.isArray(args)) event.extra!.arguments = args.map(scrubArgument);
	event.breadcrumbs = event.breadcrumbs?.map(scrubBreadcrumb);
	return event;
}

export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
	if (breadcrumb.message) breadcrumb.message = scrubEmails(breadcrumb.message);
	const args = breadcrumb.data?.arguments;
	if (Array.isArray(args)) breadcrumb.data!.arguments = args.map(scrubArgument);
	return breadcrumb;
}
