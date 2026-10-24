import { afterAll, describe, expect, it } from 'vitest';
import type { LimitDb } from '../../auth/rate-limit';
import { staffProfiles } from '../../db/schema/certification';
import { insertUser, testDb, testDbUrl } from '../../db/test-db';
import { daysFrom, insertCertificate, insertStaff } from '../certificates/test-support';
import { bornYearsAgo, insertConsent } from '../consents/test-support';
import { listPublicStaff, type StaffCard } from './public';

/* docs/06 section 4.6: public, active profiles of members who are not blocked, with a live
 * certificate; a minor's photo and description only with the `privacy` consent (docs/03 section 13). */

const NOW = new Date();

type Person = {
	kind?: 'trainer' | 'judge';
	isPublic?: boolean;
	isActive?: boolean;
	user?: Parameters<typeof insertUser>[1];
	cert?: 'live' | 'expired' | 'revoked' | 'none';
};

describe.skipIf(!testDbUrl)('listPublicStaff', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	async function person(tx: LimitDb, p: Person = {}) {
		const kind = p.kind ?? 'trainer';
		const tag = crypto.randomUUID().slice(0, 8);
		const user = await insertUser(tx, {
			firstName: 'Aram',
			lastName: `Staff-${tag}`,
			avatarKey: `avatars/${tag}.webp`,
			phone: '+37499000555',
			...p.user
		});
		const admin = await insertStaff(tx, 'admin');
		const cert = p.cert ?? 'live';
		if (cert !== 'none')
			await insertCertificate(tx, {
				userId: user.id,
				kind,
				issuedBy: admin.id,
				issuedAt: daysFrom(NOW, -400),
				expiresAt: daysFrom(NOW, cert === 'expired' ? -1 : 300),
				...(cert === 'revoked' && { status: 'revoked', revokedAt: NOW, revokeReason: 'Test' })
			});
		await tx.insert(staffProfiles).values({
			userId: user.id,
			kind,
			category: `Category ${tag}`,
			licenseNumber: `LIC-${tag}`,
			bio: { en: `Bio ${tag}`, ru: `Био ${tag}` },
			isPublic: p.isPublic ?? true,
			isActive: p.isActive ?? true
		});
		return { ...user, name: `Aram Staff-${tag}`, tag };
	}

	const find = (cards: StaffCard[], name: string) => cards.find((c) => c.name === name);

	it('trainers and judges apart; name, category, photo key and description in the language', async () => {
		await inRollback(async (tx) => {
			const coach = await person(tx);
			const judge = await person(tx, { kind: 'judge' });
			const team = await listPublicStaff(tx, 'ru', NOW);

			expect(find(team.trainers, coach.name)).toEqual({
				name: coach.name,
				category: `Category ${coach.tag}`,
				avatarKey: `avatars/${coach.tag}.webp`,
				bio: `Био ${coach.tag}`
			});
			expect(find(team.judges, judge.name)).toBeDefined();
			expect(find(team.trainers, judge.name)).toBeUndefined();
			expect(find((await listPublicStaff(tx, 'hy', NOW)).trainers, coach.name)?.bio).toBe(
				`Bio ${coach.tag}`
			);
		});
	});

	it('hidden: not public, switched off, blocked, deleted, certificate expired, revoked or missing', async () => {
		await inRollback(async (tx) => {
			const hidden = [
				await person(tx, { isPublic: false }),
				await person(tx, { isActive: false }),
				await person(tx, { user: { status: 'blocked' } }),
				await person(tx, { user: { deletedAt: NOW } }),
				await person(tx, { cert: 'expired' }),
				await person(tx, { cert: 'revoked' }),
				await person(tx, { cert: 'none' })
			];
			const { trainers } = await listPublicStaff(tx, 'en', NOW);
			for (const h of hidden) expect(find(trainers, h.name), h.name).toBeUndefined();
		});
	});

	it('a minor: name and category; photo and description only with the privacy consent', async () => {
		await inRollback(async (tx) => {
			const minor = await person(tx, { user: { birthDate: bornYearsAgo(15, NOW) } });
			const unknownAge = await person(tx, { user: { birthDate: null } });
			const consented = await person(tx, { user: { birthDate: bornYearsAgo(16, NOW) } });
			await insertConsent(tx, consented.id, { kind: 'privacy', status: 'approved' });
			const { trainers } = await listPublicStaff(tx, 'en', NOW);

			for (const p of [minor, unknownAge])
				expect(find(trainers, p.name), p.name).toMatchObject({ avatarKey: null, bio: null });
			expect(find(trainers, minor.name)?.category).toBe(`Category ${minor.tag}`);
			expect(find(trainers, consented.name)).toMatchObject({
				avatarKey: `avatars/${consented.tag}.webp`,
				bio: `Bio ${consented.tag}`
			});
		});
	});

	it('gives nothing beyond the card: no contacts, birth date, ids or licence number', async () => {
		await inRollback(async (tx) => {
			const coach = await person(tx);
			const team = await listPublicStaff(tx, 'en', NOW);
			const card = find(team.trainers, coach.name)!;
			expect(Object.keys(card).sort()).toEqual(['avatarKey', 'bio', 'category', 'name']);
			const json = JSON.stringify(team);
			for (const secret of [
				coach.email,
				coach.id,
				'+37499000555',
				'1990-01-01',
				`LIC-${coach.tag}`
			])
				expect(json).not.toContain(secret);
		});
	});
});
