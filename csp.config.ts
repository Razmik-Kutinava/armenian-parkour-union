/** Content-Security-Policy for every rendered page; SvelteKit adds a nonce for its inline script.
 * Styles stay 'unsafe-inline': Svelte writes style attributes and transitions add <style>.
 * No form-action: Google sign-in and online payment post a plain form that redirects off-site,
 * and browsers check form-action on that redirect too. */
import type { Config } from '@sveltejs/kit/vite';

const MEDIA = 'https://media.parkour.am';

export const csp: Config['csp'] = {
	mode: 'auto',
	directives: {
		'default-src': ['self'],
		'script-src': ['self'],
		'style-src': ['self', 'unsafe-inline'],
		'img-src': ['self', 'data:', 'blob:', MEDIA, 'https://i.ytimg.com'],
		'font-src': ['self'],
		'media-src': ['self', MEDIA],
		/* Uploads go straight to R2 by a signed link (storage/r2.ts); browser errors go to Sentry (EU). */
		'connect-src': ['self', 'https://*.r2.cloudflarestorage.com', 'https://*.ingest.de.sentry.io'],
		'frame-src': ['https://www.youtube-nocookie.com'],
		'object-src': ['none'],
		'base-uri': ['self'],
		'frame-ancestors': ['none']
	}
};
