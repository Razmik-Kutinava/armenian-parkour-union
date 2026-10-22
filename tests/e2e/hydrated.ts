import type { Page } from '@playwright/test';

/** After a full page load: the root layout marks <html> once the page is interactive. */
export const hydrated = (page: Page) =>
	page.locator('html[data-hydrated]').waitFor({ state: 'attached' });
