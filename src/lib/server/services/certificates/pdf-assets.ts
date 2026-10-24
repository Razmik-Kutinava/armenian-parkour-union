import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { StorageNotConfigured, type PrivateStorage } from '../../storage/types';

/* questions.md, stage 6: the seal and the signature are never in the repository or the public
 * bucket. Dev — a local folder; production — the private bucket. PNG only (transparent ink). */

export type CertificateImages = { seal: Uint8Array; signature: Uint8Array };

export const CERTIFICATE_ASSET_KEYS = {
	seal: 'certificate-assets/seal.png',
	signature: 'certificate-assets/signature.png'
} as const;

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const isPng = (b: Uint8Array | null): b is Uint8Array => !!b && PNG.every((x, i) => b[i] === x);

async function fromDir(dir: string, name: string): Promise<Uint8Array | null> {
	try {
		return new Uint8Array(await readFile(join(dir, name)));
	} catch {
		return null;
	}
}

async function fromBucket(storage: Pick<PrivateStorage, 'read'>, key: string) {
	try {
		return await storage.read(key);
	} catch (e) {
		if (e instanceof StorageNotConfigured) return null;
		throw e;
	}
}

/** Both images, or null: a certificate without the seal is not made. The folder wins when set. */
export async function loadCertificateImages(source: {
	dir?: string;
	storage?: Pick<PrivateStorage, 'read'> | null;
}): Promise<CertificateImages | null> {
	const { dir, storage } = source;
	const load = (file: 'seal' | 'signature') =>
		dir
			? fromDir(dir, `${file}.png`)
			: storage
				? fromBucket(storage, CERTIFICATE_ASSET_KEYS[file])
				: Promise.resolve(null);
	const [seal, signature] = await Promise.all([load('seal'), load('signature')]);
	return isPng(seal) && isPng(signature) ? { seal, signature } : null;
}
