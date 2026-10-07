/** File storage as the media library needs it; R2 in production, a fake in tests. */
export interface Storage {
	/** A URL the browser PUTs the file to directly; type and length are part of the signature. */
	presignPut(key: string, mime: string, size: number): Promise<string>;
	head(key: string): Promise<{ size: number } | null>;
	readStart(key: string, length: number): Promise<Uint8Array>;
	remove(key: string): Promise<void>;
}

export class StorageNotConfigured extends Error {}
