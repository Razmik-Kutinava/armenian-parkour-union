import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/* Unknown site URLs get the 404 inside the site layout (header, footer), not the bare root page. */
export const load: PageServerLoad = () => error(404, 'Not Found');
