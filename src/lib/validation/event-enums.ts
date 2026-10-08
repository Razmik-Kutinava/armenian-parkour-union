/* Values of docs/02 enums event_status and discipline; safe to import in the browser. */

export const eventStatuses = ['draft', 'published', 'finished', 'cancelled', 'archived'] as const;
export type EventStatus = (typeof eventStatuses)[number];
/** The form sets only these; finish, cancel and archive have their own buttons. */
export const eventFormStatuses = ['draft', 'published'] as const;
export const disciplines = ['speed', 'style', 'tricking', 'freerun', 'other'] as const;
export type Discipline = (typeof disciplines)[number];
