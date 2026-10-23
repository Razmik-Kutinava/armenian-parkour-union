import { error, fail, redirect, type RequestEvent } from '@sveltejs/kit';
import { defaultLocale, isLocale } from '#lib/i18n/locales.ts';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { requireUser } from '#lib/server/auth/guard.ts';
import { cached } from '#lib/server/cache/index.ts';
import { db } from '#lib/server/db/index.ts';
import { getPublicEvent } from '#lib/server/services/events/public.ts';
import { PaymentConfigError } from '#lib/server/services/payments/providers/index.ts';
import {
	cancelNow,
	payForEventNow,
	registerNow,
	type EventPayResult
} from '#lib/server/services/registrations/index.ts';

/* docs/06 section 4.3: the button is no protection — the service checks again (docs/03 section 7).
 * The member comes from the session (docs/04 section 5.3), the event from the address. */

type PayRefusal = Extract<EventPayResult, { ok: false }>['reason'];

export const payMessage = (reason: PayRefusal | 'unavailable'): MessageKey => {
	if (reason === 'unavailable' || reason === 'invalid') return 'registrations.payError.unavailable';
	if (reason === 'provider_error' || reason === 'hold_expired' || reason === 'closed') {
		return `registrations.payError.${reason}`;
	}
	return 'registrations.changed';
};

async function target({ locals, params }: RequestEvent) {
	const user = requireUser(locals.user);
	const locale = isLocale(params.lang) ? params.lang : defaultLocale;
	const event = await cached(['events'], 'event', getPublicEvent, db, params.slug ?? '', locale);
	if (!event) error(404, 'Not Found');
	return { user, eventId: event.id, locale };
}

const refuse = (code: number, message: MessageKey) =>
	fail(code, { registration: { message, error: true } });
const done = (message: MessageKey | null) => ({ registration: { message, error: false } });

export const registrationActions = {
	register: async (request: RequestEvent) => {
		const { user, eventId } = await target(request);
		const category = String((await request.request.formData()).get('categoryId') ?? '');
		const result = await registerNow(db, user.id, { eventId, categoryId: category || null });
		if (!result.ok) return refuse(400, `registrations.refused.${result.reason}`);
		return done(null);
	},

	pay: async (request: RequestEvent) => {
		const { user, eventId, locale } = await target(request);
		let result: EventPayResult;
		try {
			result = await payForEventNow(db, user.id, eventId, locale);
		} catch (e) {
			if (!(e instanceof PaymentConfigError)) throw e;
			console.error('event payment:', e.message);
			return fail(503, { payError: payMessage('unavailable') });
		}
		if (result.ok) redirect(303, result.checkoutUrl);
		return fail(result.reason === 'provider_error' ? 502 : 400, {
			payError: payMessage(result.reason)
		});
	},

	cancel: async (request: RequestEvent) => {
		const { user, eventId } = await target(request);
		const result = await cancelNow(db, user.id, eventId);
		if (result === 'too_late') return refuse(400, 'registrations.cancelLate');
		if (result !== 'ok') return refuse(400, 'registrations.changed');
		return done('registrations.cancelled');
	}
};
