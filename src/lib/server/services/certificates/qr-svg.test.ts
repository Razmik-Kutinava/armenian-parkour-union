import QRCode from 'qrcode';
import { describe, expect, it } from 'vitest';
import { qrSvg } from './qr-svg';

/* docs/06 section 5.5: the cabinet QR is the same code as in the PDF, drawn as one SVG path. */

const URL_ = 'https://parkour.am/certificate/abc_DEF-123';

/** Cells covered by `M{x} {y}h{w}v1h-{w}z` runs. */
function covered(d: string) {
	const cells = new Set<string>();
	for (const [, x, y, w] of d.matchAll(/M(\d+) (\d+)h(\d+)v1h-\3z/g)) {
		for (let i = 0; i < Number(w); i++) cells.add(`${Number(x) + i},${y}`);
	}
	return cells;
}

describe('certificates: QR as SVG', () => {
	it('covers exactly the dark modules of the code, nothing else in the path', () => {
		const { modules } = QRCode.create(URL_, { errorCorrectionLevel: 'M' });
		const { size, d } = qrSvg(URL_);
		expect(size).toBe(modules.size);
		expect(d.replace(/M\d+ \d+h(\d+)v1h-\1z/g, '')).toBe('');
		const dark = new Set<string>();
		for (let y = 0; y < modules.size; y++) {
			for (let x = 0; x < modules.size; x++) if (modules.get(y, x)) dark.add(`${x},${y}`);
		}
		expect(covered(d)).toEqual(dark);
	});

	it('another address — another code', () => {
		expect(qrSvg(`${URL_}x`).d).not.toBe(qrSvg(URL_).d);
	});
});
