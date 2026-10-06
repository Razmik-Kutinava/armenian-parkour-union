import { defineEnvVars } from '@sveltejs/kit/env';

// Optional at build time (Docker, CI typecheck); required at runtime — enforced where it is used.
const optional = (value: string | undefined) => value || undefined;

export const variables = defineEnvVars({
	DATABASE_URL: { schema: optional }
});
