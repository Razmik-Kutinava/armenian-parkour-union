import { error, fail } from '@sveltejs/kit';
import { PUBLIC_SITE_URL } from '$app/env/private';
import type { MessageKey } from '#lib/i18n/translate.ts';
import { roleCan } from '#lib/server/auth/permissions.ts';
import { requirePermission } from '#lib/server/auth/guard.ts';
import { db } from '#lib/server/db/index.ts';
import {
	certificatePdfLink,
	getCertificateCard,
	regenerateCertificatePdfNow,
	revokeCertificate
} from '#lib/server/services/certificates/index.ts';
import { r2Private } from '#lib/server/storage/r2.ts';
import { revokeSchema } from '#lib/validation/admin-certificates.ts';
import { PDF_RESULTS, pdfMessage } from '../outcome';
import type { Actions, PageServerLoad } from './$types';

/* docs/05 section 8: the card for moderator and admin; remake the PDF and revoke — admin. */
export const load: PageServerLoad = async ({ locals, params, url }) => {
	const viewer = requirePermission(locals.user, 'certificates.read');
	const found = await getCertificateCard(db, params.id);
	if (!found) error(404, 'Not found');
	const { fileKey, ...card } = found;
	const site = PUBLIC_SITE_URL || url.origin;
	return {
		card,
		pdfUrl: await certificatePdfLink(r2Private, fileKey),
		verifyUrl: new URL(`/certificate/${card.publicToken}`, site).href,
		issued: url.searchParams.has('issued'),
		issuedPdf: PDF_RESULTS.find((p) => p === url.searchParams.get('issued')) ?? null,
		canRemake: roleCan(viewer.role, 'certificates.issue'),
		canRevoke: roleCan(viewer.role, 'certificates.revoke')
	};
};

export const actions: Actions = {
	pdf: async ({ locals, params, getClientAddress }) => {
		const actor = requirePermission(locals.user, 'certificates.issue');
		const outcome = await regenerateCertificatePdfNow(db, actor, params.id, getClientAddress());
		if (outcome === 'not_found') error(404, 'Not found');
		if (outcome === 'not_allowed') error(403, 'Forbidden');
		if (outcome === 'ok') return { done: pdfMessage('ok') };
		return fail(400, { message: pdfMessage(outcome) });
	},
	revoke: async ({ locals, params, request, getClientAddress }) => {
		const actor = requirePermission(locals.user, 'certificates.revoke');
		const parsed = revokeSchema.safeParse(Object.fromEntries(await request.formData()));
		if (!parsed.success) {
			return fail(400, { message: parsed.error.issues[0].message as MessageKey });
		}
		const input = { certificateId: params.id, reason: parsed.data.comment };
		const outcome = await revokeCertificate(db, actor, input, getClientAddress());
		if (outcome === 'not_found') error(404, 'Not found');
		if (outcome === 'not_allowed') error(403, 'Forbidden');
		if (outcome === 'ok') return { done: 'certificates.revoked' as MessageKey };
		return fail(400, { message: `certificates.refusal.${outcome}` as MessageKey });
	}
};
