import { defineEnvVars } from '@sveltejs/kit/env';

// Optional at build time (Docker, CI typecheck); required at runtime — enforced where it is used.
const optional = (value: string | undefined) => value || undefined;

export const variables = defineEnvVars({
	DATABASE_URL: { schema: optional },
	BETTER_AUTH_SECRET: { schema: optional },
	PUBLIC_SITE_URL: { schema: optional },
	GOOGLE_CLIENT_ID: { schema: optional },
	GOOGLE_CLIENT_SECRET: { schema: optional },
	MAIL_API_KEY: { schema: optional },
	MAIL_FROM: { schema: optional },
	R2_ACCOUNT_ID: { schema: optional },
	R2_ACCESS_KEY_ID: { schema: optional },
	R2_SECRET_ACCESS_KEY: { schema: optional },
	R2_BUCKET: { schema: optional },
	R2_PUBLIC_URL: { schema: optional },
	CACHE_TTL_SECONDS: { schema: optional }
});
