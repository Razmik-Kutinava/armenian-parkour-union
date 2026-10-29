import { PDFDocument, PageSizes, type PDFFont, type PDFImage, type PDFPage } from 'pdf-lib';
import {
	INK,
	MUTED,
	NAVY,
	drawLogo,
	drawQr,
	drawRight,
	embedFonts,
	fitSize
} from '../certificates/pdf-draw';
import type { CardPdfContent } from './card-pdf-content';
import type { PdfImage } from './card-pdf-images';

/* docs/03 section 19.8, docs/08 section 10: A4 portrait in the site's font and navy, no gradients
 * (reads in black and white): logo, title, photo, name, number, "valid until", the check QR, then
 * the partners and their perks — over as many pages as they need; "as of" on every page. */

const [W, H] = PageSizes.A4;
const M = 48;
const BOTTOM = 56;
const PHOTO = { w: 120, h: 160 };
const QR = 120;
const LOGO = 28;
const INDENT = LOGO + 10;

type Fonts = Awaited<ReturnType<typeof embedFonts>>;

async function embed(doc: PDFDocument, image: PdfImage | null | undefined) {
	if (!image) return null;
	try {
		return image.type === 'png' ? await doc.embedPng(image.bytes) : await doc.embedJpg(image.bytes);
	} catch {
		return null;
	}
}

/** Fitted inside the box, centred; keeps the proportions. */
function contain(page: PDFPage, image: PDFImage, x: number, y: number, w: number, h: number) {
	const scale = Math.min(w / image.width, h / image.height);
	const [iw, ih] = [image.width * scale, image.height * scale];
	page.drawImage(image, { x: x + (w - iw) / 2, y: y + (h - ih) / 2, width: iw, height: ih });
}

/** Lines no wider than `width`; a word longer than the line is cut. */
export function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
	const lines: string[] = [];
	let line = '';
	for (const word of text.split(/\s+/).filter(Boolean)) {
		const next = line ? `${line} ${word}` : word;
		if (font.widthOfTextAtSize(next, size) <= width) {
			line = next;
			continue;
		}
		if (line) lines.push(line);
		line = word;
		while (font.widthOfTextAtSize(line, size) > width && line.length > 1) {
			let cut = line.length - 1;
			while (cut > 1 && font.widthOfTextAtSize(line.slice(0, cut), size) > width) cut--;
			lines.push(line.slice(0, cut));
			line = line.slice(cut);
		}
	}
	if (line) lines.push(line);
	return lines;
}

function head(page: PDFPage, f: Fonts, c: CardPdfContent, photo: PDFImage | null) {
	drawLogo(page, M, H - M + 8, 52);
	page.drawText(c.union, { x: M + 64, y: H - M - 14, font: f.bold, size: 11, color: NAVY });
	const titleSize = fitSize(c.title, f.bold, 24, W - 2 * M - 64);
	page.drawText(c.title, { x: M + 64, y: H - M - 40, font: f.bold, size: titleSize, color: NAVY });
	page.drawLine({ start: { x: M, y: H - 112 }, end: { x: W - M, y: H - 112 }, color: NAVY });

	const top = H - 132;
	page.drawRectangle({
		x: M,
		y: top - PHOTO.h,
		width: PHOTO.w,
		height: PHOTO.h,
		borderColor: MUTED,
		borderWidth: 0.8
	});
	if (photo) contain(page, photo, M + 2, top - PHOTO.h + 2, PHOTO.w - 4, PHOTO.h - 4);

	const x = M + PHOTO.w + 20;
	const width = W - M - QR - 16 - x;
	const nameSize = fitSize(c.holder, f.bold, 20, width);
	page.drawText(c.holder, { x, y: top - 22, font: f.bold, size: nameSize, color: INK });
	[c.number, c.validUntil].forEach((field, i) => {
		const y = top - 60 - i * 44;
		page.drawText(field.label, { x, y, font: f.regular, size: 8, color: MUTED });
		page.drawText(field.value, { x, y: y - 16, font: f.bold, size: 13, color: INK });
	});
	drawQr(page, c.verify.url, W - M - QR, top - QR, QR, INK);
	const label = { font: f.regular, color: MUTED };
	drawRight(page, c.verify.label, W - M, top - QR - 12, { ...label, size: 7.5 });
	const urlSize = fitSize(c.verify.url, f.regular, 6.5, QR + 80);
	drawRight(page, c.verify.url, W - M, top - QR - 22, { ...label, size: urlSize });
	return top - PHOTO.h - 36;
}

export async function renderCardPdf(
	content: CardPdfContent,
	images: { photo: PdfImage | null; logos: Map<string, PdfImage> }
): Promise<Uint8Array<ArrayBuffer>> {
	const doc = await PDFDocument.create();
	doc.setTitle(content.number.value);
	doc.setAuthor(content.union);
	doc.setSubject(content.title);
	const f = await embedFonts(doc);
	const logos = new Map<string, PDFImage | null>();
	for (const key of images.logos.keys()) logos.set(key, await embed(doc, images.logos.get(key)));

	let page = doc.addPage([W, H]);
	let y = head(page, f, content, await embed(doc, images.photo));
	const room = (need: number) => {
		if (y - need >= BOTTOM) return;
		page = doc.addPage([W, H]);
		y = H - M;
	};
	page.drawText(content.partnersTitle, { x: M, y, font: f.bold, size: 14, color: NAVY });
	y -= 24;
	if (!content.partners.length) {
		page.drawText(content.empty, { x: M, y, font: f.regular, size: 10, color: MUTED });
	}
	const text = (s: string, font: PDFFont, sz: number, color = INK) => {
		for (const line of wrap(s, font, sz, W - 2 * M - INDENT)) {
			room(sz + 4);
			page.drawText(line, { x: M + INDENT, y, font, size: sz, color });
			y -= sz + 4;
		}
	};
	for (const partner of content.partners) {
		room(LOGO + 24);
		const logo = partner.logoKey ? logos.get(partner.logoKey) : null;
		if (logo) contain(page, logo, M, y - LOGO + 10, LOGO, LOGO);
		page.drawText(partner.name, { x: M + INDENT, y, font: f.bold, size: 12, color: INK });
		y -= 18;
		for (const perk of partner.perks) {
			text(`• ${perk.title}`, f.bold, 10.5);
			if (perk.terms) text(perk.terms, f.regular, 9, MUTED);
			y -= 3;
		}
		y -= 8;
	}
	for (const p of doc.getPages()) {
		p.drawText(content.asOf, { x: M, y: 28, font: f.regular, size: 8, color: MUTED });
		drawRight(p, content.number.value, W - M, 28, { font: f.regular, size: 8, color: MUTED });
	}
	return (await doc.save()) as Uint8Array<ArrayBuffer>;
}
