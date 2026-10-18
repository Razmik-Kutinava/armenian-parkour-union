/* Plain lists for pages and the server alike (docs/02 `hero_type`). */
export const heroTypes = ['event', 'presentation', 'video', 'person', 'custom'] as const;
export type HeroType = (typeof heroTypes)[number];
