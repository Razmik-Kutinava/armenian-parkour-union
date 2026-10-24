import { describe, expect, it } from 'vitest';

/* docs/03 sections 3.2, 3.5, 15, roadmap 6.10: `users.level` is written in two places only — the
 * certificate issue and "novice" on the first fee. Any new write (a form, an admin action, raw SQL)
 * fails here first; manual lowering (section 3.4) will have to be added to the list on purpose. */

const sources = import.meta.glob<string>(
	[
		'/src/**/*.ts',
		'!/src/**/*.test.ts',
		'!/src/**/test-support.ts',
		'!/src/**/race-support.ts',
		'!/src/lib/server/db/test-db.ts'
	],
	{ query: '?raw', import: 'default', eager: true }
);

const LEVEL_WRITERS = [
	'/src/lib/server/services/certificates/issue.ts',
	'/src/lib/server/services/memberships/activate.ts'
];
/** A patch passed by name cannot be read here; each one is checked to list its keys, none of them `level`. */
const NAMED_PATCHES = ['/src/lib/server/services/users/edit.ts'];

/** The argument of the `.set(` / `.values(` call that starts at `from`. */
function argumentAt(text: string, from: number) {
	let depth = 0;
	for (let i = from; i < text.length; i++) {
		if ('({['.includes(text[i])) depth++;
		if (')}]'.includes(text[i]) && --depth === 0) return text.slice(from + 1, i).trim();
	}
	return '';
}

function usersWrites(text: string) {
	const found: string[] = [];
	for (const m of text.matchAll(/\.(update|insert)\(\s*users\s*\)/g)) {
		const call = /\.(set|values)\(/.exec(text.slice(m.index));
		if (call) found.push(argumentAt(text, m.index + call.index + call[0].length - 1));
	}
	return found;
}

const writesLevel = (patch: string) => /(^|[{,\s])level\s*[:,}]/.test(patch);
const isNamed = (patch: string) => !patch.startsWith('{') || patch.includes('...');
const rawSqlLevel = (text: string) => /update\s+"?users"?\s+set\b[^`;]*\blevel\b/i.test(text);

describe('users.level is written only by the level services', () => {
	const files = Object.entries(sources);

	it('the scan sees the code (sanity)', () => {
		expect(files.length).toBeGreaterThan(100);
		expect(usersWrites(sources[LEVEL_WRITERS[0]]).some(writesLevel)).toBe(true);
	});

	it('only the certificate issue and the first fee set the level', () => {
		const writers = files
			.filter(([, text]) => usersWrites(text).some(writesLevel) || rawSqlLevel(text))
			.map(([file]) => file)
			.sort();
		expect(writers).toEqual(LEVEL_WRITERS);
	});

	it('no other write to users passes a patch that could hide the level', () => {
		const named = files
			.filter(([file, text]) => !LEVEL_WRITERS.includes(file) && usersWrites(text).some(isNamed))
			.map(([file]) => file)
			.sort();
		expect(named).toEqual(NAMED_PATCHES);
	});

	it('the sign-up and profile API of Better Auth does not accept the level, role or status', () => {
		const auth = sources['/src/lib/server/auth/index.ts'];
		expect(auth).toMatch(/const readOnly = \{[^}]*\binput: false\b/);
		for (const field of ['level', 'role', 'status'])
			expect(auth).toMatch(new RegExp(`\\b${field}: \\{ type: 'string', \\.\\.\\.readOnly \\}`));
	});
});
