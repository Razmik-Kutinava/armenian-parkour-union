/* Limits of the product and order forms for both sides: shop.ts imports the server rich text
 * schema and cannot reach the browser (docs/todo.md 7.4, decisions 3, 5–7). */
export const itemStatuses = ['draft', 'published', 'archived'] as const;
export const itemFormStatuses = ['draft', 'published'] as const;
export const ITEM_IMAGES_MAX = 10;
export const ITEM_OPTIONS_MAX = 5;
export const TRACKING_NOTE_MAX = 500;
