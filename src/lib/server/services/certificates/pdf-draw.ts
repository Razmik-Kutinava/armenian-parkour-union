import fontkit from '@pdf-lib/fontkit';
import { rgb, type Color, type PDFDocument, type PDFFont, type PDFPage } from 'pdf-lib';
import QRCode from 'qrcode';
import logoSvg from '../../../../../static/brand/logo-square.svg?raw';
import regularFont from '#lib/assets/fonts/apu-sans/apu-sans-400.ttf?inline';
import boldFont from '#lib/assets/fonts/apu-sans/apu-sans-700.ttf?inline';

/* docs/08 sections 2, 4, 10: the site's own font (Armenian, Cyrillic, Latin) embedded, the logo as
 * vectors, the QR as squares — nothing raster except the seal and the signature. */

export const NAVY = rgb(0x1f / 255, 0x4e / 255, 0x78 / 255);
export const INK = rgb(0x1c / 255, 0x22 / 255, 0x28 / 255);
export const MUTED = rgb(0x4a / 255, 0x55 / 255, 0x60 / 255);

const dataUriBytes = (uri: string) => Buffer.from(uri.slice(uri.indexOf(',') + 1), 'base64');

/** TTF copies of the site's woff2, embedded whole: pdf-lib puts woff2 bytes in the PDF as is (viewers
 * reject them), and its subsetting drops glyphs. */
export async function embedFonts(doc: PDFDocument) {
	doc.registerFontkit(fontkit);
	return {
		regular: await doc.embedFont(dataUriBytes(regularFont)),
		bold: await doc.embedFont(dataUriBytes(boldFont))
	};
}

export type Text = { font: PDFFont; size: number; color: Color };

/** The size at which the text fits `maxWidth` (never larger than asked). */
export const fitSize = (text: string, font: PDFFont, size: number, maxWidth: number) =>
	Math.min(size, (size * maxWidth) / Math.max(font.widthOfTextAtSize(text, size), 1));

export function drawCentered(page: PDFPage, text: string, cx: number, y: number, t: Text) {
	const width = t.font.widthOfTextAtSize(text, t.size);
	page.drawText(text, { x: cx - width / 2, y, ...t });
}

export function drawRight(page: PDFPage, text: string, right: number, y: number, t: Text) {
	page.drawText(text, { x: right - t.font.widthOfTextAtSize(text, t.size), y, ...t });
}

const LOGO_VIEWBOX = 1332;
const LOGO_PATHS = [...logoSvg.matchAll(/<path\b([^>]*)>/g)].map(([, attrs]) => ({
	fill: /fill="#([0-9a-fA-F]{6})"/.exec(attrs)?.[1] ?? '000000',
	d: /\sd="([^"]+)"/.exec(attrs)?.[1] ?? ''
}));

const hex = (h: string) =>
	rgb(...([0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number]));

/** The logo with its top-left corner at (x, top), `size` points square. */
export function drawLogo(page: PDFPage, x: number, top: number, size: number) {
	const scale = size / LOGO_VIEWBOX;
	for (const p of LOGO_PATHS) page.drawSvgPath(p.d, { x, y: top, scale, color: hex(p.fill) });
}

/** The QR code with its bottom-left corner at (x, y); dark runs of a row are one rectangle. */
export function drawQr(
	page: PDFPage,
	url: string,
	x: number,
	y: number,
	size: number,
	color: Color
) {
	const { modules } = QRCode.create(url, { errorCorrectionLevel: 'M' });
	const cell = size / modules.size;
	for (let row = 0; row < modules.size; row++) {
		for (let col = 0; col < modules.size; col++) {
			if (!modules.get(row, col)) continue;
			const start = col;
			while (col + 1 < modules.size && modules.get(row, col + 1)) col++;
			page.drawRectangle({
				x: x + start * cell,
				y: y + size - (row + 1) * cell,
				width: (col - start + 1) * cell,
				height: cell,
				color
			});
		}
	}
}
