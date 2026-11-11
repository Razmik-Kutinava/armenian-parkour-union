"""One-shot: designer JPGs → site/PDF PNG + favicon SVG. Run from repo root."""
from __future__ import annotations

import base64
import io
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
BRAND = ROOT / 'src' / 'lib' / 'assets' / 'brand'
STATIC = ROOT / 'static' / 'brand'


def square(img: Image.Image) -> Image.Image:
	img = img.convert('RGBA')
	w, h = img.size
	side = min(w, h)
	left = (w - side) // 2
	top = (h - side) // 2
	return img.crop((left, top, left + side, top + side))


def flatten_white(img: Image.Image) -> Image.Image:
	bg = Image.new('RGB', img.size, (255, 255, 255))
	bg.paste(img, mask=img.split()[-1])
	return bg


def circular_mark(img_rgb: Image.Image) -> Image.Image:
	"""Crop to the round seal and clear corners so the tab icon reads as a circle."""
	rgba = img_rgb.convert('RGBA')
	pixels = rgba.load()
	w, h = rgba.size
	xs: list[int] = []
	ys: list[int] = []
	for y in range(h):
		for x in range(w):
			r, g, b, _a = pixels[x, y]
			if r < 245 or g < 245 or b < 245:
				xs.append(x)
				ys.append(y)
	if not xs:
		raise SystemExit('favicon: empty logo')
	# Seal is circular; horizontal span is the diameter (URL under the ring is secondary).
	left, right = min(xs), max(xs)
	cx = (left + right) / 2
	radius = (right - left) / 2
	cy = min(ys) + radius
	side = int(round(radius * 2))
	box = (
		int(round(cx - radius)),
		int(round(cy - radius)),
		int(round(cx - radius)) + side,
		int(round(cy - radius)) + side,
	)
	crop = rgba.crop(box)
	mask = Image.new('L', (side, side), 0)
	ImageDraw.Draw(mask).ellipse((0, 0, side - 1, side - 1), fill=255)
	out = Image.new('RGBA', (side, side), (0, 0, 0, 0))
	out.paste(crop, (0, 0), mask)
	return out


def write_favicon(img_rgb: Image.Image, size: int = 128) -> None:
	fav = circular_mark(img_rgb).resize((size, size), Image.Resampling.LANCZOS)
	buf = io.BytesIO()
	fav.save(buf, 'PNG', optimize=True)
	b64 = base64.b64encode(buf.getvalue()).decode('ascii')
	(STATIC / 'favicon.svg').write_text(
		f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}">'
		f'<image href="data:image/png;base64,{b64}" width="{size}" height="{size}"/>'
		f'</svg>\n',
		encoding='utf-8',
	)


def main() -> None:
	# Primary mark is always designer logo 3 (full color). Mono variants stay as sources only.
	color = BRAND / 'designer-logo-3.jpg'
	if not color.exists():
		raise SystemExit(f'missing {color}')
	print('color', color.name)

	STATIC.mkdir(parents=True, exist_ok=True)
	color_rgb = flatten_white(square(Image.open(color)).resize((512, 512), Image.Resampling.LANCZOS))
	color_rgb.save(STATIC / 'logo-square.png', 'PNG', optimize=True)
	color_rgb.save(BRAND / 'logo-square.png', 'PNG', optimize=True)
	# Header used to import *-light; keep the same color mark so dark UI never gets mono.
	color_rgb.resize((256, 256), Image.Resampling.LANCZOS).save(
		BRAND / 'logo-square-light.png', 'PNG', optimize=True
	)

	write_favicon(color_rgb)

	# Stub SVG so /brand/logo-square.svg still resolves if anything links it.
	(STATIC / 'logo-square.svg').write_text(
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">'
		'<image href="/brand/logo-square.png" width="512" height="512"/>'
		'</svg>\n',
		encoding='utf-8',
	)

	print('static png', (STATIC / 'logo-square.png').stat().st_size)
	print('light png', (BRAND / 'logo-square-light.png').stat().st_size)
	print('favicon', (STATIC / 'favicon.svg').stat().st_size)


if __name__ == '__main__':
	main()
