import { fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { defaultLocale, isLocale } from '#lib/i18n/locales.ts';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { requireUser } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import { listOwnEvents } from '#lib/server/services/cabinet/events.ts';
import { PaymentConfigError } from '#lib/server/services/payments/providers/index.ts';
import {
	cancelNow,
	payForEventNow,
	registrationSettings,
	type EventPayResult
} from '#lib/server/services/registrations/index.ts';
import { isUuid } from '#lib/server/services/users/target.ts';
import { payMessage } from '../../events/[slug]/registration-actions';
import type { Actions, PageServerLoad } from './$types';

/* docs/06 section 5.4: own registrations only; the user comes from the session (docs/04 section
 * 5.3). Pay and cancel are the event page's services: they check the registration again. */

const localeOf = (lang: string | undefined) => (isLocale(lang) ? lang : defaultLocale);

export const load: PageServerLoad = async ({ locals, params, url, setHeaders }) => {
	const user = requireUser(locals.user);
	setHeaders({ 'cache-control': 'no-store' });
	const settings = await registrationSettings(db);
	const own = await listOwnEvents(db, user.id, localeOf(params.lang), settings);
	return { ...own, tab: url.searchParams.get('tab') === 'past' ? 'past' : 'upcoming' };
};

async function target({ locals, request }: RequestEvent) {
	const user = requireUser(locals.user);
	const eventId = String((await request.formData()).get('eventId') ?? '');
	return { user, eventId: isUuid(eventId) ? eventId : null };
}

const notice = (message: MessageKey, error = true) => ({ notice: { message, error } });

export const actions: Actions = {
	pay: async (request) => {
		const { user, eventId } = await target(request);
		if (!eventId) return fail(400, notice('registrations.changed'));
		let result: EventPayResult;
		try {
			result = await payForEventNow(db, user.id, eventId, localeOf(request.params.lang));
		} catch (e) {
			if (!(e instanceof PaymentConfigError)) throw e;
			console.error('event payment:', e.message);
			return fail(503, notice(payMessage('unavailable')));
		}
		if (result.ok) redirect(303, result.checkoutUrl);
		return fail(result.reason === 'provider_error' ? 502 : 400, notice(payMessage(result.reason)));
	},

	cancel: async (request) => {
		const { user, eventId } = await target(request);
		if (!eventId) return fail(400, notice('registrations.changed'));
		const result = await cancelNow(db, user.id, eventId);
		if (result === 'too_late') return fail(400, notice('registrations.cancelLate'));
		if (result !== 'ok') return fail(400, notice('registrations.changed'));
		return notice('registrations.cancelled', false);
	}
};
