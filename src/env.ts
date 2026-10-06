import { defineEnvVars } from '@sveltejs/kit/env';

const required = (name: string) => (value: string | undefined) => {
	if (!value) throw new Error(`${name} is not set`);
	return value;
};

export const variables = defineEnvVars({
	DATABASE_URL: { schema: required('DATABASE_URL') }
});
