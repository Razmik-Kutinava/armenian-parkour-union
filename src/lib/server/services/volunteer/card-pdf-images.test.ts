import { describe, expect, it } from 'vitest';
import { loadCardImages, loadPdfImage, type ImageFetch } from './card-pdf-images';

/* docs/todo.md 10.4 (4): pdf-lib embeds JPEG and PNG only. A library picture is asked from
 * Cloudflare as JPEG; elsewhere — the original if it is JPEG or PNG; any failure — no picture. */

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const WEBP = new Uint8Array([...'RIFF\0\0\0\0WEBPVP8 '].map((c) => c.charCodeAt(0)));
const MEDIA = 'https://media.parkour.am/avatars/u/a.webp';
const RESIZED = 'https://media.parkour.am/cdn-cgi/image/width=600,fit=scale-down,format=jpeg,background=white/avatars/u/a.webp';

function server(files: Record<string, Uint8Array | 'fail' | 'hang'>) {
	const asked: string[] = [];
	const fetcher: ImageFetch = async (url, { signal }) => {
		asked.push(url);
		const file = files[url];
		if (file === 'fail') throw new Error('network');
		if (file === 'hang') {
			return new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason)));
		}
		return file ? new Response(file) : new Response('missing', { status: 404 });
	};
	return { asked, fetcher };
}

describe('volunteer card PDF images', () => {
	it('a library picture: the JPEG variant from Cloudflare', async () => {
		const { asked, fetcher } = server({ [RESIZED]: JPEG });
		expect(await loadPdfImage(MEDIA, 600, fetcher)).toEqual({ bytes: JPEG, type: 'jpeg' });
		expect(asked).toEqual([RESIZED]);
	});

	it('the variant fails — the original, but only JPEG or PNG', async () => {
		const png = server({ [RESIZED]: 'fail', [MEDIA]: PNG });
		expect(await loadPdfImage(MEDIA, 600, png.fetcher)).toEqual({ bytes: PNG, type: 'png' });
		expect(png.asked).toEqual([RESIZED, MEDIA]);
		const webp = server({ [MEDIA]: WEBP });
		expect(await loadPdfImage(MEDIA, 600, webp.fetcher)).toBeNull();
	});

	it('another host: only the original is asked', async () => {
		const url = 'https://dev-media.example/avatars/a.jpg';
		const { asked, fetcher } = server({ [url]: JPEG });
		expect(await loadPdfImage(url, 600, fetcher)).toEqual({ bytes: JPEG, type: 'jpeg' });
		expect(asked).toEqual([url]);
	});

	it('no address, a network error or a hung server — no picture, no throw', async () => {
		const { asked, fetcher } = server({ [RESIZED]: 'hang', [MEDIA]: 'hang' });
		expect(await loadPdfImage(null, 600, fetcher)).toBeNull();
		expect(asked).toEqual([]);
		expect(await loadPdfImage(MEDIA, 600, fetcher, 20)).toBeNull();
		expect(await loadPdfImage(MEDIA, 600, server({ [RESIZED]: 'fail', [MEDIA]: 'fail' }).fetcher)).toBeNull();
	});

	it('too large a file is not embedded', async () => {
		const big = new Uint8Array(6 * 1024 * 1024);
		big.set(JPEG);
		expect(await loadPdfImage(MEDIA, 600, server({ [RESIZED]: big }).fetcher)).toBeNull();
	});

	it('the photo and each logo once, keyed by the storage key', async () => {
		const toUrl = (key: string) => `https://dev-media.example/${key}`;
		const { asked, fetcher } = server({
			'https://dev-media.example/avatars/me.jpg': JPEG,
			'https://dev-media.example/media/logo.png': PNG
		});
		const images = await loadCardImages(
			{ avatarKey: 'avatars/me.jpg', logoKeys: ['media/logo.png', 'media/logo.png', 'media/gone.png'] },
			toUrl,
			fetcher
		);
		expect(images.photo).toEqual({ bytes: JPEG, type: 'jpeg' });
		expect([...images.logos.keys()]).toEqual(['media/logo.png']);
		expect(asked.filter((u) => u.endsWith('logo.png'))).toHaveLength(1);
		const offline = await loadCardImages({ avatarKey: null, logoKeys: [] }, () => null, fetcher);
		expect(offline).toEqual({ photo: null, logos: new Map() });
	});
});
