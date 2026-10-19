/* docs/06 section 3.1: system pages with their own address; the rest live under /pages. */
const OWN_PATHS: Record<string, string> = { about: '/federation', join: '/join' };

/** Public address of a `pages` row, without the language prefix. */
export const pagePath = (slug: string): string => OWN_PATHS[slug] ?? `/pages/${slug}`;
