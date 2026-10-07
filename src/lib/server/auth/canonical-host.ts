/** `www.` duplicates the site for search engines: the bare domain is canonical. */
export function canonicalHostRedirect(url: URL): string | null {
	if (!url.hostname.startsWith('www.')) return null;
	const target = new URL(url);
	target.hostname = url.hostname.slice('www.'.length);
	return target.href;
}
