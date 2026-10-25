/** Content-Security-Policy for every rendered page; SvelteKit adds a nonce for its inline script.
 * Styles stay 'unsafe-inline': Svelte writes style attributes and transitions add <style>.
 * form-action: the Google button and payment without JS post a plain form that redirects off-site,
 * and Chrome checks form-action on those redirects too. A new payment host — add it here. */
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
		'form-action': ['self', 'https://accounts.google.com', 'https://checkout.vpos.am'],
		'frame-ancestors': ['none']
	}
};
