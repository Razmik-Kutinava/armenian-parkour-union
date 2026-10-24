import { desc, eq } from 'drizzle-orm';
import type { LocalizedText } from '#lib/i18n/localized.ts';
import type { StaffProfileValues } from '#lib/validation/admin-staff.ts';
import { roleCan } from '../../auth/permissions';
import type { LimitDb } from '../../auth/rate-limit';
import { certificates, staffProfiles } from '../../db/schema/certification';
import { users } from '../../db/schema/users';
import { writeAudit } from '../audit';
import { isUuid, type Actor } from '../users/target';
import { liveCertificateOf, type StaffKind } from './profile';

/* docs/05 section 9: the profile card and the admin's corrections. Names only — no contacts or
 * birth dates (docs/04 section 4); routes check `certificates.read` first. docs/03 section 5: the
 * form may switch a profile off, but on only while a live certificate of its kind exists. */

export type StaffCard = NonNullable<Awaited<ReturnType<typeof getStaffCard>>>;
export type StaffUpdate = 'ok' | 'not_found' | 'not_allowed' | 'no_live_certificate';

const FIELDS = ['category', 'licenseNumber', 'bio', 'isPublic', 'isActive'] as const;

/** jsonb keeps its own key order: compare the description by sorted keys. */
const canonical = (value: unknown) =>
	JSON.stringify(
		value && typeof value === 'object' ? Object.entries(value).sort() : (value ?? null)
	);

async function liveCertificate(db: LimitDb, userId: string, kind: StaffKind, now: Date) {
	const [row] = await db
		.select({ id: certificates.id, number: certificates.number, expiresAt: certificates.expiresAt })
		.from(certificates)
		.where(liveCertificateOf(userId, kind, now))
		.orderBy(desc(certificates.issuedAt))
		.limit(1);
	return row ?? null;
}

export async function getStaffCard(db: LimitDb, id: string, now = new Date()) {
	if (!isUuid(id)) return null;
	const [row] = await db
		.select({
			id: staffProfiles.id,
			userId: staffProfiles.userId,
			memberName: users.name,
			avatarKey: users.avatarKey,
			kind: staffProfiles.kind,
			category: staffProfiles.category,
			licenseNumber: staffProfiles.licenseNumber,
			bio: staffProfiles.bio,
			isPublic: staffProfiles.isPublic,
			isActive: staffProfiles.isActive
		})
		.from(staffProfiles)
		.innerJoin(users, eq(users.id, staffProfiles.userId))
		.where(eq(staffProfiles.id, id));
	if (!row) return null;
	return {
		...row,
		bio: row.bio as Partial<LocalizedText> | null,
		certificate: await liveCertificate(db, row.userId, row.kind, now)
	};
}

/** Under the member row lock, like `syncStaffProfile`: no race with an issue or a revoke. */
export async function updateStaffProfile(
	db: LimitDb,
	actor: Actor,
	id: string,
	values: StaffProfileValues,
	ip: string | null,
	now = new Date()
): Promise<StaffUpdate> {
	if (!roleCan(actor.role, 'staff_profiles.write')) return 'not_allowed';
	if (!isUuid(id)) return 'not_found';
	return db.transaction(async (tx) => {
		const [owner] = await tx
			.select({ userId: staffProfiles.userId })
			.from(staffProfiles)
			.where(eq(staffProfiles.id, id));
		if (!owner) return 'not_found';
		await tx.select({ id: users.id }).from(users).where(eq(users.id, owner.userId)).for('update');
		const [before] = await tx
			.select()
			.from(staffProfiles)
			.where(eq(staffProfiles.id, id))
			.for('update');
		if (values.isActive && !before.isActive) {
			if (!(await liveCertificate(tx, before.userId, before.kind, now))) {
				return 'no_live_certificate';
			}
		}
		const changed = FIELDS.filter((f) => canonical(before[f]) !== canonical(values[f]));
		if (changed.length === 0) return 'ok';
		await tx.update(staffProfiles).set(values).where(eq(staffProfiles.id, id));
		await writeAudit(tx, {
			actorId: actor.id,
			action: 'staff_profile.update',
			entityType: 'staff_profile',
			entityId: id,
			before: Object.fromEntries(changed.map((f) => [f, before[f] ?? null])),
			after: Object.fromEntries(changed.map((f) => [f, values[f]])),
			ip
		});
		return 'ok';
	});
}
