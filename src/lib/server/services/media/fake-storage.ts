import type { Storage } from '../../storage/types';

/* Test support only: an in-memory bucket with the same contract as R2. */
export function fakeStorage(): Storage & { objects: Map<string, Uint8Array> } {
	const objects = new Map<string, Uint8Array>();
	return {
		objects,
		async presignPut(key, mime, size) {
			return `https://bucket.test/${key}?type=${encodeURIComponent(mime)}&size=${size}`;
		},
		async head(key) {
			const body = objects.get(key);
			return body ? { size: body.length } : null;
		},
		async readStart(key, length) {
			return (objects.get(key) ?? new Uint8Array()).slice(0, length);
		},
		async remove(key) {
			objects.delete(key);
		}
	};
}
