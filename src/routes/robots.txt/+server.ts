import { siteUrl } from '#lib/server/services/posts/view.ts';
import { renderRobots } from '#lib/seo/robots.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ url }) =>
	new Response(renderRobots(siteUrl(url)), {
		headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'max-age=3600' }
	});
