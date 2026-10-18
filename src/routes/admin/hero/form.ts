import { error, fail } from '@sveltejs/kit';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { db } from '#lib/server/db/index.ts';
import { heroLimit } from '#lib/server/services/hero/checks.ts';
import { listHeroEventChoices } from '#lib/server/services/hero/choices.ts';
import { getHeroPerson } from '#lib/server/services/hero/persons.ts';
import { heroFormSchema, type HeroValues } from '#lib/validation/hero.ts';
import { flattenValues, formToObject, settingsErrors } from '#lib/validation/site-settings-form.ts';
import { coverChoices } from '../events/form';

export async function readHeroForm(request: Request) {
	const raw = formToObject(await request.formData());
	const parsed = heroFormSchema.safeParse(raw);
	if (parsed.success) return { values: parsed.data as HeroValues, raw };
	return {
		failure: fail(400, { values: flattenValues(raw), errors: settingsErrors(parsed.error) })
	};
}

const refusalField: Record<string, [string, MessageKey]> = {
	bad_media: ['mediaKey', 'hero.error.media'],
	bad_event: ['eventId', 'hero.error.eventGone'],
	bad_person: ['personUserId', 'hero.error.personGone']
};

/** Service refusals: field errors, the limit and the archive as messages, 403 / 404 for the rest. */
export async function refused(result: string, raw: Record<string, unknown>) {
	if (result === 'not_found') error(404, 'Not found');
	if (result === 'not_allowed') error(403, 'Forbidden');
	const values = flattenValues(raw);
	if (result === 'limit') return fail(400, { values, limit: true as const });
	if (result === 'bad_state') return fail(400, { values, badState: true as const });
	const [field, message] = refusalField[result];
	return fail(400, { values, errors: { [field]: message } });
}

/** What the form offers: library images, events and the chosen person's name. */
export async function heroChoices(eventId: string | null, personId: string | null) {
	const person = personId ? await getHeroPerson(db, personId) : null;
	return {
		...(await coverChoices()),
		events: await listHeroEventChoices(db, eventId),
		personName: person?.name ?? null,
		max: await heroLimit(db)
	};
}
