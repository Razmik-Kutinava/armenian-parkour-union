/* Values of docs/02 enums for partners and perks; safe to import in the browser. */

export const volunteerStatuses = ['draft', 'published', 'archived'] as const;
export type VolunteerStatus = (typeof volunteerStatuses)[number];
export const perkKinds = ['reusable', 'single'] as const;
