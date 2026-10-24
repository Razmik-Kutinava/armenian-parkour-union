import {
	DeleteObjectCommand,
	GetObjectCommand,
	HeadObjectCommand,
	NotFound,
	PutObjectCommand,
	S3Client
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
	R2_ACCESS_KEY_ID,
	R2_ACCOUNT_ID,
	R2_BUCKET,
	R2_PRIVATE_BUCKET,
	R2_PUBLIC_URL,
	R2_SECRET_ACCESS_KEY
} from '$app/env/private';
import { StorageNotConfigured, type PrivateStorage, type Storage } from './types';

const UPLOAD_TTL_SECONDS = 15 * 60;
const VIEW_TTL_SECONDS = 5 * 60;

let client: S3Client | undefined;
function connect(bucket: string | undefined): { client: S3Client; bucket: string } {
	if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !bucket) {
		throw new StorageNotConfigured('R2_* is not set');
	}
	client ??= new S3Client({
		region: 'auto',
		endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
		credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY }
	});
	return { client, bucket };
}

const isMissing = (e: unknown) =>
	e instanceof NotFound || (e as { name?: string })?.name === 'NoSuchKey';

/** The bucket name is read on each call: the build imports this module without secrets. */
function bucketStorage(bucketName: () => string | undefined): PrivateStorage {
	const s3 = () => connect(bucketName());
	return {
		async presignPut(key, mime, size) {
			const { client, bucket } = s3();
			const command = new PutObjectCommand({
				Bucket: bucket,
				Key: key,
				ContentType: mime,
				ContentLength: size
			});
			return getSignedUrl(client, command, {
				expiresIn: UPLOAD_TTL_SECONDS,
				signableHeaders: new Set(['content-type', 'content-length'])
			});
		},
		async presignGet(key, mime) {
			const { client, bucket } = s3();
			const command = new GetObjectCommand({ Bucket: bucket, Key: key, ResponseContentType: mime });
			return getSignedUrl(client, command, { expiresIn: VIEW_TTL_SECONDS });
		},
		async head(key) {
			const { client, bucket } = s3();
			try {
				const res = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
				return { size: res.ContentLength ?? 0 };
			} catch (e) {
				if (isMissing(e)) return null;
				throw e;
			}
		},
		async readStart(key, length) {
			const { client, bucket } = s3();
			const res = await client.send(
				new GetObjectCommand({ Bucket: bucket, Key: key, Range: `bytes=0-${length - 1}` })
			);
			return (await res.Body?.transformToByteArray()) ?? new Uint8Array();
		},
		async put(key, body, mime) {
			const { client, bucket } = s3();
			await client.send(
				new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: mime })
			);
		},
		async read(key) {
			const { client, bucket } = s3();
			try {
				const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
				return (await res.Body?.transformToByteArray()) ?? new Uint8Array();
			} catch (e) {
				if (isMissing(e)) return null;
				throw e;
			}
		},
		async remove(key) {
			const { client, bucket } = s3();
			await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
		}
	};
}

/** The media bucket behind `R2_PUBLIC_URL`: everything in it is public. */
export const r2: Storage = bucketStorage(() => R2_BUCKET);

/** Personal documents (consents, certificate PDFs, seal and signature): no public address. */
export const r2Private: PrivateStorage = bucketStorage(() => R2_PRIVATE_BUCKET);

/** Public address of a stored file, or null until the bucket is connected. */
export function publicUrl(key: string): string | null {
	return R2_PUBLIC_URL ? `${R2_PUBLIC_URL.replace(/\/+$/, '')}/${key}` : null;
}
