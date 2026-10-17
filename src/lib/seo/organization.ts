/* docs/06 section 7.3: schema.org Organization on the home page. */

export type SeoOrganization = {
	sameAs: string[];
	email?: string;
	phone?: string;
	/** When the page description is not about the federation itself (an announcement). */
	description?: string;
};

export function organizationMarkup(
	name: string,
	url: string,
	description: string,
	org: SeoOrganization
) {
	return {
		'@context': 'https://schema.org',
		'@type': 'Organization',
		name,
		url,
		description: org.description ?? description,
		...(org.sameAs.length > 0 && { sameAs: org.sameAs }),
		...(org.email && { email: org.email }),
		...(org.phone && { telephone: org.phone })
	};
}
