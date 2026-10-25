import type { Mail } from './resend';

const BRAND = 'Armenian Parkour Union';
const FONT = "'Noto Sans', 'Noto Sans Armenian', Arial, Helvetica, sans-serif";
const ADDRESS = /https?:\/\/[^\s<>"']+/g;
const NOT_ADDRESS_TAIL = /[.,;:!?)\]]+$/;

const escape = (text: string) =>
	text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');

const link = (url: string, label = url) =>
	`<a href="${escape(url)}" style="color:#1F4E78;text-decoration:underline;">${escape(label)}</a>`;

/** Plain text with its addresses as links; a dot or bracket after an address stays text. */
function withLinks(text: string): string {
	let html = '';
	let last = 0;
	for (const match of text.matchAll(ADDRESS)) {
		const url = match[0].replace(NOT_ADDRESS_TAIL, '');
		html += escape(text.slice(last, match.index)) + link(url);
		last = match.index + url.length;
	}
	return html + escape(text.slice(last));
}

const paragraphs = (text: string) =>
	text
		.split(/\n{2,}/)
		.filter((part) => part.trim())
		.map((part) => `<p style="margin:0 0 16px;">${withLinks(part).replace(/\n/g, '<br>')}</p>`)
		.join('');

function footer(siteUrl: string | undefined): string {
	if (!siteUrl) return BRAND;
	return `${BRAND} · ${link(siteUrl, new URL(siteUrl).host)}`;
}

/** docs/03 section 14, docs/08 sections 2-3: every letter in one brand layout, no images. */
export function letterHtml(mail: Mail, siteUrl: string | undefined): string {
	return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(mail.subject)}</title></head>
<body style="margin:0;padding:0;background:#F2F7FB;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F2F7FB;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#FFFFFF;border-radius:8px;overflow:hidden;">
<tr><td style="background:#1F4E78;padding:20px 32px;color:#FFFFFF;font:700 18px/1.3 ${FONT};letter-spacing:0.02em;">${BRAND}</td></tr>
<tr><td style="height:4px;line-height:4px;font-size:0;background:#FF8A1F;">&nbsp;</td></tr>
<tr><td style="padding:32px;color:#0A1A2B;font:16px/1.6 ${FONT};">${paragraphs(mail.text)}</td></tr>
<tr><td style="padding:16px 32px;background:#E3EDF6;color:#163A5C;font:13px/1.5 ${FONT};">${footer(siteUrl)}</td></tr>
</table></td></tr></table>
</body></html>`;
}
