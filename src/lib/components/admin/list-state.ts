/* Admin lists keep page, sort, search and filters in the URL (docs/05 section 1, item 2). */

export const PAGE_SIZE = 25;
const SEARCH_MAX = 200;

export type SortDir = 'asc' | 'desc';
/** URLSearchParams or the read-only `page.url.searchParams`. */
type Params = { get(name: string): string | null; toString(): string };
export type ListOptions = {
	sortable: readonly string[];
	filters: readonly string[];
	defaultSort: { key: string; dir: SortDir };
};
export type ListState = {
	page: number;
	sort: string;
	dir: SortDir;
	q: string;
	filters: Record<string, string>;
};

/** Only known sort keys and filters pass: the URL never reaches the query unchecked. */
export function readListState(params: Params, opts: ListOptions): ListState {
	const rawPage = params.get('page') ?? '';
	const page = /^\d+$/.test(rawPage) && Number(rawPage) >= 1 ? Number(rawPage) : 1;
	const rawSort = params.get('sort') ?? '';
	const sort = opts.sortable.includes(rawSort) ? rawSort : opts.defaultSort.key;
	const rawDir = params.get('dir');
	const dir: SortDir =
		rawDir === 'asc' || rawDir === 'desc'
			? rawDir
			: sort === opts.defaultSort.key
				? opts.defaultSort.dir
				: 'asc';
	const filters: Record<string, string> = {};
	for (const key of opts.filters) {
		const value = params.get(key)?.trim();
		if (value) filters[key] = value;
	}
	return { page, sort, dir, q: (params.get('q') ?? '').trim().slice(0, SEARCH_MAX), filters };
}

/** New list address; any change except the page itself goes back to page 1. */
export function listHref(
	pathname: string,
	params: Params,
	patch: Record<string, string | null>
): string {
	const next = new URLSearchParams(params.toString());
	if (Object.keys(patch).some((k) => k !== 'page')) next.delete('page');
	for (const [key, value] of Object.entries(patch)) {
		if (value === null || value === '') next.delete(key);
		else next.set(key, value);
	}
	const qs = next.toString();
	return qs ? `${pathname}?${qs}` : pathname;
}

export function sortHref(pathname: string, params: Params, key: string, state: ListState): string {
	const dir = state.sort === key && state.dir === 'asc' ? 'desc' : 'asc';
	return listHref(pathname, params, { sort: key, dir });
}

export const pageCount = (total: number) => Math.max(1, Math.ceil(total / PAGE_SIZE));
export const pageOffset = (page: number) => (page - 1) * PAGE_SIZE;
