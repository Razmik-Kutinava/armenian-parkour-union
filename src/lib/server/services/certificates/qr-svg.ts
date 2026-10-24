import QRCode from 'qrcode';

/* docs/06 section 5.5: the cabinet QR — the same code as `drawQr` puts in the PDF, built on the
 * server as one SVG path (a module is 1 × 1), so the browser gets no QR library. */

export type QrSvg = { size: number; d: string };

export function qrSvg(url: string): QrSvg {
	const { modules } = QRCode.create(url, { errorCorrectionLevel: 'M' });
	let d = '';
	for (let row = 0; row < modules.size; row++) {
		for (let col = 0; col < modules.size; col++) {
			if (!modules.get(row, col)) continue;
			const start = col;
			while (col + 1 < modules.size && modules.get(row, col + 1)) col++;
			const width = col - start + 1;
			d += `M${start} ${row}h${width}v1h-${width}z`;
		}
	}
	return { size: modules.size, d };
}
