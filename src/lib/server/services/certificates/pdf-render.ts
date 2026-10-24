import { PDFDocument, PageSizes, type PDFPage } from 'pdf-lib';
import type { CertificateImages } from './pdf-assets';
import type { CertificateContent, Multilingual } from './pdf-content';
import {
	INK,
	MUTED,
	NAVY,
	drawCentered,
	drawLogo,
	drawQr,
	drawRight,
	embedFonts,
	fitSize
} from './pdf-draw';

/* docs/08 section 10: A4 landscape, navy frame, logo on top, the holder's name large, type and
 * level, number and dates, signature and seal (~4 cm), the verification QR. No gradients: it must
 * read in black and white. */

const [H, W] = PageSizes.A4;
const CX = W / 2;
const MARGIN = 64;
const SEAL = 112;
const SIGNATURE_WIDTH = 120;
const QR = 84;

type Fonts = Awaited<ReturnType<typeof embedFonts>>;

function frame(page: PDFPage) {
	page.drawRectangle({
		x: 20,
		y: 20,
		width: W - 40,
		height: H - 40,
		borderColor: NAVY,
		borderWidth: 4
	});
	page.drawRectangle({
		x: 30,
		y: 30,
		width: W - 60,
		height: H - 60,
		borderColor: NAVY,
		borderWidth: 0.8
	});
}

/** `main` large, the other languages on one line below; returns the y under the block. */
function block(
	page: PDFPage,
	f: Fonts,
	text: Multilingual,
	y: number,
	size: number,
	upper = false
) {
	const up = (s: string) => (upper ? s.toLocaleUpperCase() : s);
	const main = up(text.main);
	const mainSize = fitSize(main, f.bold, size, W - 2 * MARGIN);
	drawCentered(page, main, CX, y, { font: f.bold, size: mainSize, color: size > 20 ? NAVY : INK });
	if (!text.rest.length) return y - mainSize * 0.6;
	const rest = text.rest.map(up).join('  ·  ');
	const restSize = fitSize(rest, f.regular, Math.max(9, size * 0.42), W - 2 * MARGIN);
	drawCentered(page, rest, CX, y - restSize - 8, { font: f.regular, size: restSize, color: MUTED });
	return y - restSize - 8;
}

function header(page: PDFPage, f: Fonts, c: CertificateContent) {
	const logo = 78;
	drawLogo(page, CX - logo / 2, H - 44, logo);
	block(page, f, c.union, H - 44 - logo - 22, 13);
	block(page, f, c.title, H - 210, 34, true);
	const nameSize = fitSize(c.holder, f.bold, 36, W - 2 * MARGIN - 40);
	drawCentered(page, c.holder, CX, 300, { font: f.bold, size: nameSize, color: INK });
	page.drawLine({
		start: { x: CX - 170, y: 290 },
		end: { x: CX + 170, y: 290 },
		thickness: 0.6,
		color: NAVY
	});
	const under = block(page, f, c.kind, 258, 17);
	if (c.category) {
		const line = `${c.category.label}: ${c.category.value}`;
		drawCentered(page, line, CX, under - 20, { font: f.regular, size: 11, color: INK });
	}
}

function footer(page: PDFPage, f: Fonts, c: CertificateContent) {
	c.fields.forEach((field, i) => {
		const y = 170 - i * 36;
		page.drawText(field.label, { x: MARGIN, y, font: f.regular, size: 7.5, color: MUTED });
		page.drawText(field.value, { x: MARGIN, y: y - 14, font: f.bold, size: 12, color: INK });
	});
	const signX = CX - 30;
	page.drawLine({
		start: { x: signX - 90, y: 90 },
		end: { x: signX + 90, y: 90 },
		thickness: 0.6,
		color: INK
	});
	drawCentered(page, c.signature, signX, 78, { font: f.regular, size: 7.5, color: MUTED });
	const qrX = W - MARGIN - QR;
	drawQr(page, c.verify.url, qrX, 92, QR, INK);
	drawRight(page, c.verify.label, W - MARGIN, 80, { font: f.regular, size: 7.5, color: MUTED });
	drawRight(page, c.verify.url, W - MARGIN, 68, { font: f.regular, size: 6.5, color: MUTED });
}

export async function renderCertificatePdf(
	content: CertificateContent,
	images: CertificateImages
): Promise<Uint8Array> {
	const doc = await PDFDocument.create();
	doc.setTitle(content.number);
	doc.setAuthor(content.union.main);
	doc.setSubject(content.kind.main);
	const [seal, signature] = [await doc.embedPng(images.seal), await doc.embedPng(images.signature)];
	const fonts = await embedFonts(doc);
	const page = doc.addPage([W, H]);
	frame(page);
	header(page, fonts, content);
	footer(page, fonts, content);
	const sign = signature.scale(SIGNATURE_WIDTH / signature.width);
	page.drawImage(signature, { x: CX - 30 - sign.width / 2, y: 92, ...sign });
	const sealHeight = SEAL * (seal.height / seal.width);
	page.drawImage(seal, {
		x: CX + 90 - SEAL / 2,
		y: 110 - sealHeight / 2,
		width: SEAL,
		height: sealHeight
	});
	return doc.save();
}
