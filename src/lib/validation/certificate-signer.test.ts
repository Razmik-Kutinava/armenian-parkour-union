import { describe, expect, it } from 'vitest';
import { signerFormSchema } from './certificate-signer';

/* questions.md stage 6 (2026-10-26): the signer under the PDF line — name and title per language;
 * English is the fallback, so it is required once anything is filled; all empty — no signer. */

const empty = { nameHy: '', nameEn: '', nameRu: '', titleHy: '', titleEn: '', titleRu: '' };
const parse = (values: Partial<typeof empty>) => signerFormSchema.safeParse({ ...empty, ...values });

describe('certificate signer form', () => {
	it('all empty — no signer', () => {
		expect(parse({})).toMatchObject({ success: true, data: null });
		expect(parse({ nameEn: '   ' })).toMatchObject({ success: true, data: null });
	});

	it('trimmed; empty translations are left out', () => {
		const result = parse({
			nameEn: ' Razmik Giurdzian ',
			titleEn: 'Head of the Federation',
			nameHy: 'Ռազմիկ Գյուրջյան',
			titleRu: 'руководитель федерации'
		});
		expect(result).toMatchObject({
			success: true,
			data: {
				name: { en: 'Razmik Giurdzian', hy: 'Ռազմիկ Գյուրջյան' },
				title: { en: 'Head of the Federation', ru: 'руководитель федерации' }
			}
		});
		if (result.success) expect(result.data?.name).not.toHaveProperty('ru');
	});

	it('something filled without the English name or title — an error on that field', () => {
		const noTitle = parse({ nameEn: 'Razmik Giurdzian' });
		expect(noTitle.success).toBe(false);
		expect(noTitle.error?.issues.map((i) => [i.path.join('.'), i.message])).toEqual([
			['titleEn', 'certificates.signer.error.required']
		]);
		const onlyArmenian = parse({ nameHy: 'Ռազմիկ', titleHy: 'ղեկավար' });
		expect(onlyArmenian.error?.issues.map((i) => i.path.join('.')).sort()).toEqual([
			'nameEn',
			'titleEn'
		]);
	});

	it('longer than 80 characters — an error', () => {
		const result = parse({ nameEn: 'R'.repeat(81), titleEn: 'Head' });
		expect(result.error?.issues.map((i) => [i.path.join('.'), i.message])).toEqual([
			['nameEn', 'certificates.signer.error.long']
		]);
	});
});
