import { afterAll, describe, expect, it } from 'vitest';
import { account } from '../db/schema/auth';
import { insertUser, testDb, testDbUrl } from '../db/test-db';
import type { LimitDb } from './rate-limit';
import { needsProfile, profileGateRedirect } from './profile-gate';

describe('profileGateRedirect', () => {
	it('lets through only the profile form and logout, in any language', () => {
		for (const path of ['/complete-profile', '/hy/complete-profile', '/logout', '/ru/logout']) {
			expect(profileGateRedirect(path, 'en')).toBeNull();
		}
	});

	it('sends everything else to the form in the page language', () => {
		expect(profileGateRedirect('/', 'en')).toBe('/complete-profile');
		expect(profileGateRedirect('/events', 'en')).toBe('/complete-profile');
		expect(profileGateRedirect('/ru/news', 'ru')).toBe('/ru/complete-profile');
		expect(profileGateRedirect('/admin', 'hy')).toBe('/hy/complete-profile');
		expect(profileGateRedirect('/complete-profile-x', 'en')).toBe('/complete-profile');
	});
});

describe.skipIf(!testDbUrl)('needsProfile', () => {
	const { inRollback, close } = testDb();
	afterAll(close);

	const linkGoogle = (tx: LimitDb, userId: string) =>
		tx.insert(account).values({
			userId,
			accountId: `g-${crypto.randomUUID()}`,
			providerId: 'google'
		});

	it('true for a Google account without consent', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, { birthDate: null, termsAcceptedAt: null });
			await linkGoogle(tx, user.id);
			expect(await needsProfile(tx, { id: user.id, termsAcceptedAt: null })).toBe(true);
		});
	});

	it('false once consent is given', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, { termsAcceptedAt: new Date() });
			await linkGoogle(tx, user.id);
			expect(await needsProfile(tx, { id: user.id, termsAcceptedAt: new Date() })).toBe(false);
		});
	});

	it('false for a user without Google (created by an admin: consent is stage 5)', async () => {
		await inRollback(async (tx) => {
			const user = await insertUser(tx, { termsAcceptedAt: null });
			expect(await needsProfile(tx, { id: user.id, termsAcceptedAt: null })).toBe(false);
		});
	});
});
