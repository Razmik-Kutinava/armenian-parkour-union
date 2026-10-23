import { eq } from 'drizzle-orm';
import type { LimitDb } from '../../auth/rate-limit';
import { users } from '../../db/schema/users';
import type { RegistrationRecipient } from './mail';

export const RECIPIENT = {
	email: users.email,
	locale: users.locale,
	firstName: users.firstName,
	name: users.name
};

export async function recipientOf(
	tx: LimitDb,
	userId: string
): Promise<RegistrationRecipient | null> {
	const [user] = await tx.select(RECIPIENT).from(users).where(eq(users.id, userId));
	return user ?? null;
}
