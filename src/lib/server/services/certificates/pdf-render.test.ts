import { PDFArray, PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { certificateContent, pdfLanguages } from './pdf-content';
import { renderCertificatePdf } from './pdf-render';
import { TEST_IMAGES } from './test-support';

/* docs/08 section 10: one A4 landscape page, fonts embedded (Armenian), seal and signature. */

const content = (holder: string, kind: 'level' | 'judge' = 'level') =>
	certificateContent(
		{
			kind,
			level: kind === 'level' ? 'advanced' : null,
			category: kind === 'judge' ? 'International' : null,
			number: 'APU-2026-0001',
			publicToken: 'abc',
			issuedAt: new Date('2026-10-24T08:00:00Z'),
			expiresAt: kind === 'judge' ? new Date('2028-10-24T08:00:00Z') : null
		},
		{ name: holder, firstName: null, lastName: null },
		{
			languages: pdfLanguages({ pdfRussian: true }),
			unionNames: ['Armenian Parkour Union'],
			siteUrl: 'https://parkour.test',
			signer: {
				name: { hy: 'Ռազմիկ Գյուրջյան', en: 'Razmik Giurdzian', ru: 'Размик Гюрджян' },
				title: {
					hy: 'ֆեդերացիայի ղեկավար',
					en: 'Head of the Federation',
					ru: 'руководитель федерации'
				}
			}
		}
	);

const latin1 = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1');

describe('certificates: PDF render', () => {
	it('one A4 landscape page, the number as the title, two images, an embedded font', async () => {
		const bytes = await renderCertificatePdf(content('Արամ Պետրոսյան'), TEST_IMAGES);
		expect(latin1(bytes.slice(0, 5))).toBe('%PDF-');
		const doc = await PDFDocument.load(bytes);
		expect(doc.getPageCount()).toBe(1);
		const { width, height } = doc.getPage(0).getSize();
		expect(Math.round(width)).toBe(842);
		expect(Math.round(height)).toBe(595);
		expect(doc.getTitle()).toBe('APU-2026-0001');
		const resources = doc.getPage(0).node.Resources();
		expect(resources?.lookup(PDFName.of('XObject'), PDFDict).keys()).toHaveLength(2);
		const fonts = resources?.lookup(PDFName.of('Font'), PDFDict);
		expect(new Set(fonts?.values().map(String))).toHaveProperty('size', 2);
		for (const name of fonts?.keys() ?? []) {
			const font = fonts?.lookup(name, PDFDict);
			const cid = font?.lookup(PDFName.of('DescendantFonts'), PDFArray).lookup(0, PDFDict);
			const descriptor = cid?.lookup(PDFName.of('FontDescriptor'), PDFDict);
			expect(descriptor?.has(PDFName.of('FontFile2'))).toBe(true);
		}
	});

	it('long names, Cyrillic and a judge with category and expiry render', async () => {
		const long = 'Александр-Константин Вартанович Тер-Петросян-Мкртчян '.repeat(3);
		const bytes = await renderCertificatePdf(content(long, 'judge'), TEST_IMAGES);
		expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
	});

	it('a broken image is an error, not a PDF without the seal', async () => {
		const broken = { ...TEST_IMAGES, seal: new Uint8Array([1, 2, 3]) };
		await expect(renderCertificatePdf(content('Aram'), broken)).rejects.toThrow();
	});
});
