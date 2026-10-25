import { error, fail, type RequestEvent } from '@sveltejs/kit';
import { defaultLocale, isLocale } from '#lib/i18n/locales.ts';
import { requireUser } from '#lib/server/auth/guard.ts';
import { cached } from '#lib/server/cache/index.ts';
import { db } from '#lib/server/db/index.ts';
import { ownBalance } from '#lib/server/services/shop/checkout-data.ts';
import { placeOrderNow } from '#lib/server/services/shop/checkout-now.ts';
import { orderButton } from '#lib/server/services/shop/order-button.ts';
import { getShopItem } from '#lib/server/services/shop/public.ts';
import { fieldErrors, keepValues } from '#lib/validation/form.ts';
import { DELIVERY_FIELDS, deliverySchema, optionsFromForm } from '#lib/validation/shop-order.ts';
import type { Actions, PageServerLoad } from './$types';

/* docs/06 section 4.7: delivery form → confirmation → the order (docs/03 section 9 item 3).
 * Decisions — docs/todo.md 7.6 (4, 9). The button state is read again on every step. */

async function context(event: RequestEvent) {
	const user = requireUser(event.locals.user);
	const lang = event.params.lang;
	const locale = isLocale(lang) ? lang : defaultLocale;
	const item = await cached(['shop'], 'shopItem', getShopItem, db, event.params.slug ?? '', locale);
	if (!item) error(404, 'Not Found');
	return { user, item };
}

export const load: PageServerLoad = async (event) => {
	const { user, item } = await context(event);
	const chosen = Object.fromEntries(
		item.options.map((o) => [o.name, event.url.searchParams.get(o.name) ?? ''])
	);
	const { slug, title, pricePoints, options } = item;
	return {
		item: { slug, title, pricePoints, options },
		button: await orderButton(db, user.id, item.id),
		chosen
	};
};

async function readForm(event: RequestEvent, names: string[]) {
	const form = await event.request.formData();
	return {
		form,
		values: keepValues(form, DELIVERY_FIELDS),
		options: optionsFromForm(form, names),
		parsed: deliverySchema.safeParse(Object.fromEntries(form))
	};
}

export const actions: Actions = {
	review: async (event) => {
		const { user, item } = await context(event);
		const { values, options, parsed } = await readForm(
			event,
			item.options.map((o) => o.name)
		);
		const errors = parsed.success ? {} : fieldErrors(parsed.error);
		if (item.options.some((o) => !o.values.includes(options[o.name]))) {
			errors.options = 'shop.checkout.error.options';
		}
		if (!parsed.success || errors.options) return fail(400, { errors, values, options });
		const button = await orderButton(db, user.id, item.id);
		const balance = await ownBalance(db, user.id);
		if (button.state !== 'can_order' || balance === null) {
			return fail(409, { changed: true as const, values, options });
		}
		const balanceAfter = balance - button.price;
		const orderId = crypto.randomUUID();
		return {
			confirm: { orderId, delivery: parsed.data, options, price: button.price, balanceAfter }
		};
	},

	edit: async (event) => {
		const { item } = await context(event);
		const { values, options } = await readForm(
			event,
			item.options.map((o) => o.name)
		);
		return { values, options };
	},

	place: async (event) => {
		const { user, item } = await context(event);
		const read = await readForm(
			event,
			item.options.map((o) => o.name)
		);
		const { form, values, options, parsed } = read;
		if (!parsed.success) return fail(400, { errors: fieldErrors(parsed.error), values, options });
		const orderId = String(form.get('orderId') ?? '');
		const input = { orderId, itemId: item.id, options, delivery: parsed.data };
		const result = await placeOrderNow(db, user.id, input);
		if (result.ok) return { placed: { number: result.number, points: result.points } };
		if (result.reason === 'options_invalid') {
			const errors = { options: 'shop.checkout.error.options' as const };
			return fail(400, { errors, values, options });
		}
		return fail(409, { changed: true as const, values, options });
	}
};
