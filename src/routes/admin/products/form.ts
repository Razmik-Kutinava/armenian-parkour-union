import { error, fail } from '@sveltejs/kit';
import { R2_PUBLIC_URL } from '$app/env/private';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { db } from '#lib/server/db/index.ts';
import type { ItemDetail } from '#lib/server/services/shop/item-list.ts';
import { listImageChoices } from '#lib/server/services/media/list.ts';
import { publicUrl } from '#lib/server/storage/r2.ts';
import { itemFormSchema, type ItemValues } from '#lib/validation/shop.ts';
import { flattenValues, formToObject, settingsErrors } from '#lib/validation/site-settings-form.ts';

/** The product form, cleaned on the server: the description is stored as richTextSchema returns it. */
export async function readItemForm(request: Request) {
	const raw = formToObject(await request.formData());
	const parsed = itemFormSchema(R2_PUBLIC_URL || null).safeParse(raw);
	if (parsed.success) return { values: parsed.data as ItemValues, raw };
	return {
		failure: fail(400, { values: flattenValues(raw), errors: settingsErrors(parsed.error) })
	};
}

const refusalField: Record<string, [string, MessageKey]> = {
	slug_taken: ['slug', 'pages.error.slugTaken'],
	bad_image: ['imageKeys', 'shop.error.image']
};

/** Service refusals: field errors for the form, 403 / 404 for the rest. */
export function refused(result: string, raw: Record<string, unknown>) {
	if (result === 'not_found') error(404, 'Not found');
	if (result === 'not_allowed') error(403, 'Forbidden');
	const [field, message] = refusalField[result];
	return fail(400, { values: flattenValues(raw), errors: { [field]: message } });
}

/** The latest library images for the photos. */
export async function imageChoices() {
	const images = await listImageChoices(db);
	return { images: images.map((m) => ({ ...m, url: publicUrl(m.key) })) };
}

/** The saved product as form field values; lists as numbered fields. */
export function formValues(item: ItemDetail): Record<string, string> {
	const options = Object.entries(item.options ?? {}).map(([name, values]) => ({
		name,
		values: values.join(', ')
	}));
	return {
		...flattenValues({
			title: item.title,
			description: item.description,
			imageKeys: item.imageKeys,
			options
		}),
		slug: item.slug,
		pricePoints: String(item.pricePoints),
		stock: item.stock === null ? '' : String(item.stock),
		status: item.status,
		sortOrder: String(item.sortOrder)
	};
}
