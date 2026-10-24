import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { StorageNotConfigured } from '../../storage/types';
import { fakeStorage } from '../media/fake-storage';
import { CERTIFICATE_ASSET_KEYS, loadCertificateImages } from './pdf-assets';
import { TEST_IMAGES } from './test-support';

/* questions.md, stage 6: seal and signature never live in the repository — dev reads a folder
 * (`CERTIFICATE_ASSETS_DIR`), production the private bucket; without either file there is no PDF. */

describe('certificates: seal and signature', () => {
	let dir: string;
	beforeAll(async () => {
		dir = await mkdtemp(join(tmpdir(), 'apu-assets-'));
	});
	afterAll(() => rm(dir, { recursive: true, force: true }));

	const folder = async (files: Record<string, Uint8Array>) => {
		const d = await mkdtemp(join(dir, 'case-'));
		for (const [name, body] of Object.entries(files)) await writeFile(join(d, name), body);
		return d;
	};

	it('the folder: both PNG files', async () => {
		const d = await folder({ 'seal.png': TEST_IMAGES.seal, 'signature.png': TEST_IMAGES.signature });
		expect(await loadCertificateImages({ dir: d })).toEqual(TEST_IMAGES);
	});

	it('the folder: a missing or non-PNG file — nothing', async () => {
		expect(await loadCertificateImages({ dir: await folder({ 'seal.png': TEST_IMAGES.seal }) })).toBe(
			null
		);
		const notPng = await folder({
			'seal.png': new TextEncoder().encode('GIF89a'),
			'signature.png': TEST_IMAGES.signature
		});
		expect(await loadCertificateImages({ dir: notPng })).toBeNull();
		expect(await loadCertificateImages({ dir: join(dir, 'nowhere') })).toBeNull();
	});

	it('the private bucket: fixed keys; the folder wins when set', async () => {
		const storage = fakeStorage();
		storage.objects.set(CERTIFICATE_ASSET_KEYS.seal, TEST_IMAGES.seal);
		storage.objects.set(CERTIFICATE_ASSET_KEYS.signature, TEST_IMAGES.signature);
		expect(await loadCertificateImages({ storage })).toEqual(TEST_IMAGES);

		const swapped = await folder({
			'seal.png': TEST_IMAGES.signature,
			'signature.png': TEST_IMAGES.seal
		});
		const fromDir = await loadCertificateImages({ dir: swapped, storage });
		expect(fromDir?.seal).toEqual(TEST_IMAGES.signature);
	});

	it('the bucket without the files or not connected — nothing', async () => {
		const storage = fakeStorage();
		storage.objects.set(CERTIFICATE_ASSET_KEYS.seal, TEST_IMAGES.seal);
		expect(await loadCertificateImages({ storage })).toBeNull();
		const offline = {
			...fakeStorage(),
			read: async () => {
				throw new StorageNotConfigured('no bucket');
			}
		};
		expect(await loadCertificateImages({ storage: offline })).toBeNull();
		expect(await loadCertificateImages({})).toBeNull();
	});
});
