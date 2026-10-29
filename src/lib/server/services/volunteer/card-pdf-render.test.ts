import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import type { CardPdfContent } from './card-pdf-content';
import type { PdfImage } from './card-pdf-images';
import { renderCardPdf } from './card-pdf-render';

/* docs/03 section 19.8, docs/08 section 10: a real PDF in the site's font (Armenian too); the
 * partner list goes on to the next pages; missing pictures do not stop it. */

const b64 = (s: string) => new Uint8Array(Buffer.from(s, 'base64'));
const PNG: PdfImage = {
	type: 'png',
	bytes: b64(
		'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
	)
};
const JPEG: PdfImage = {
	type: 'jpeg',
	bytes: b64(
		'/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA='
	)
};

const content = (partners: CardPdfContent['partners']): CardPdfContent => ({
	title: 'Կամավորի գրքույկ',
	union: 'Armenian Parkour Union',
	holder: 'Արամ Պետրոսյան',
	number: { label: 'Համար', value: 'APU-V-2026-0007' },
	validUntil: { label: 'Գործում է մինչև', value: '01.04.2027' },
	verify: { label: 'Ստուգում', url: 'https://parkour.am/hy/volunteer/tok' },
	partnersTitle: 'Գործընկերներ',
	empty: 'Առաջարկներ չկան',
	asOf: 'Արդիական է 30.10.2026',
	partners
});

const pages = async (bytes: Uint8Array) => (await PDFDocument.load(bytes)).getPageCount();

describe('volunteer card PDF drawing', () => {
	it('one page without pictures and partners', async () => {
		const bytes = await renderCardPdf(content([]), { photo: null, logos: new Map() });
		expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
		expect(await pages(bytes)).toBe(1);
	});

	it('photo and logos as JPEG or PNG; a long list goes to more pages', async () => {
		const many = Array.from({ length: 30 }, (_, i) => ({
			name: `Partner ${i}`,
			logoKey: i % 2 ? 'media/a.png' : 'media/b.jpg',
			perks: [
				{
					title: `Գնի ${i}% զեղչ`,
					terms: 'Ցույց տվեք QR-ը դրամարկղում։ '.repeat(8)
				}
			]
		}));
		const logos = new Map([
			['media/a.png', PNG],
			['media/b.jpg', JPEG]
		]);
		const bytes = await renderCardPdf(content(many), { photo: JPEG, logos });
		expect(await pages(bytes)).toBeGreaterThan(1);
	});

	it('a broken picture is skipped, not thrown', async () => {
		const broken: PdfImage = { type: 'png', bytes: new Uint8Array([1, 2, 3]) };
		const one = [{ name: 'Gym', logoKey: 'media/x.png', perks: [{ title: 'Gift', terms: null }] }];
		const bytes = await renderCardPdf(content(one), {
			photo: broken,
			logos: new Map([['media/x.png', broken]])
		});
		expect(await pages(bytes)).toBe(1);
	});
});
