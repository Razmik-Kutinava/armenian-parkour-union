// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { Locale } from '#lib/i18n/locales.ts';
import type { LocalsUser } from '#lib/server/auth/session.ts';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			locale: Locale;
			/** null for guests and for blocked or deleted users (hooks.server.ts). */
			user: LocalsUser | null;
		}
		interface PageData {
			/** Overrides the URL locale where the address has no prefix (admin: profile language). */
			locale?: Locale;
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
