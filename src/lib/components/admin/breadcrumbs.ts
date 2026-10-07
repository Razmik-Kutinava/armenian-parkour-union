import type { MessageKey } from '#lib/i18n/translate.ts';

export type Crumb = { key: MessageKey; href: string };
type Nav = readonly {
	readonly items: readonly { readonly key: string; readonly href: string }[];
}[];

const ROOT: Crumb = { key: 'admin.title', href: '/admin' };

/** Admin root, then the menu section that contains the current address. */
export function breadcrumbs(nav: Nav, pathname: string): Crumb[] {
	const section = nav
		.flatMap((g) => g.items)
		.find(
			(i) => i.href !== ROOT.href && (pathname === i.href || pathname.startsWith(`${i.href}/`))
		);
	return section ? [ROOT, { key: section.key as MessageKey, href: section.href }] : [ROOT];
}
