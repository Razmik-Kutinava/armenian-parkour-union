import { describe, expect, it } from 'vitest';
import { PAGE_SIZE, listHref, pageCount, pageOffset, readListState, sortHref } from './list-state';

const opts = {
	sortable: ['name', 'createdAt'],
	filters: ['role', 'status'],
	defaultSort: { key: 'createdAt', dir: 'desc' }
} as const;
const params = (s: string) => new URLSearchParams(s);

describe('readListState', () => {
	it('defaults: page 1, default sort, no search or filters', () => {
		expect(readListState(params(''), opts)).toEqual({
			page: 1,
			sort: 'createdAt',
			dir: 'desc',
			q: '',
			filters: {}
		});
	});

	it('reads page, sort, direction, search and known filters', () => {
		expect(readListState(params('page=3&sort=name&dir=asc&q=+anna+&role=editor&status='), opts)).toEqual({
			page: 3,
			sort: 'name',
			dir: 'asc',
			q: 'anna',
			filters: { role: 'editor' }
		});
	});

	it('ignores unknown sort keys and filters, bad page and direction', () => {
		const s = readListState(params('page=-2&sort=password&dir=sideways&secret=1'), opts);
		expect(s).toMatchObject({ page: 1, sort: 'createdAt', dir: 'desc', filters: {} });
		expect(readListState(params('page=abc'), opts).page).toBe(1);
		expect(readListState(params('page=2.5'), opts).page).toBe(1);
	});

	it('limits the search length', () => {
		expect(readListState(params(`q=${'a'.repeat(500)}`), opts).q).toHaveLength(200);
	});
});

describe('list links', () => {
	it('changing a filter drops the page; changing the page keeps filters', () => {
		const p = params('role=editor&page=4');
		expect(listHref('/admin/users', p, { status: 'blocked' })).toBe(
			'/admin/users?role=editor&status=blocked'
		);
		expect(listHref('/admin/users', p, { role: null })).toBe('/admin/users');
		expect(listHref('/admin/users', p, { page: '5' })).toBe('/admin/users?role=editor&page=5');
	});

	it('sort link toggles direction on the same column, starts ascending on another', () => {
		const p = params('sort=name&dir=asc&page=2');
		const state = readListState(p, opts);
		expect(sortHref('/admin/users', p, 'name', state)).toBe('/admin/users?sort=name&dir=desc');
		expect(sortHref('/admin/users', p, 'createdAt', state)).toBe(
			'/admin/users?sort=createdAt&dir=asc'
		);
	});
});

describe('pagination', () => {
	it('25 per page (docs/05 section 1)', () => {
		expect(PAGE_SIZE).toBe(25);
		expect(pageCount(0)).toBe(1);
		expect(pageCount(25)).toBe(1);
		expect(pageCount(26)).toBe(2);
		expect(pageOffset(3)).toBe(50);
	});
});
