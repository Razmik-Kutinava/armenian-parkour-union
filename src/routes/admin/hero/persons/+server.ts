import { error, json } from '@sveltejs/kit';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { searchHeroPersons } from '#lib/server/services/hero/persons.ts';
import type { RequestHandler } from './$types';

/* Person search for the form: adults only, id + name + avatar (K4). */
export const GET: RequestHandler = async ({ locals, url }) => {
	const actor = requirePermission(locals.user, 'hero.write');
	const found = await searchHeroPersons(db, actor, url.searchParams.get('q') ?? '');
	if (found === 'not_allowed') error(403, 'Forbidden');
	return json(found);
};
