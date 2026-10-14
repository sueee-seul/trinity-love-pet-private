import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  type GetObjectCommandOutput,
  type HeadObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const OBJECT_STORAGE_CACHE_CONTROL = 'public, max-age=86400, immutable';
export const OBJECT_STORAGE_UPLOAD_URL_EXPIRES_SECONDS = 300;

export interface ObjectStorageConfiguration {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

interface PutObjectInput {
  key: string;
  body: Buffer;
  contentType: string;
  cacheControl?: string;
}

interface PresignedPutObjectInput {
  key: string;
  contentType: string;
  cacheControl?: string;
}

let s3Client: S3Client | null = null;

const getRequiredEnvironmentVariable = (name: string): string => {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing object storage configuration: ${name}`);
  }
  return value;
};

export const getObjectStorageConfiguration = (): ObjectStorageConfiguration => ({
  endpoint: getRequiredEnvironmentVariable('AWS_ENDPOINT_URL_S3'),
  region: getRequiredEnvironmentVariable('AWS_REGION'),
  accessKeyId: getRequiredEnvironmentVariable('AWS_ACCESS_KEY_ID'),
  secretAccessKey: getRequiredEnvironmentVariable('AWS_SECRET_ACCESS_KEY'),
  bucket: getRequiredEnvironmentVariable('NEON_S3_BUCKET'),
});

const getS3Client = (configuration: ObjectStorageConfiguration): S3Client => {
  if (!s3Client) {
    s3Client = new S3Client({
      endpoint: configuration.endpoint,
      forcePathStyle: true,
      region: configuration.region,
      credentials: {
        accessKeyId: configuration.accessKeyId,
        secretAccessKey: configuration.secretAccessKey,
      },
    });
  }
  return s3Client;
};

export const putObject = async (input: PutObjectInput): Promise<void> => {
  const configuration = getObjectStorageConfiguration();
  await getS3Client(configuration).send(
    new PutObjectCommand({
      Bucket: configuration.bucket,
      Key: input.key,
      Body: input.body,
      ContentType: input.contentType,
      CacheControl: input.cacheControl ?? OBJECT_STORAGE_CACHE_CONTROL,
    }),
  );
};

export const createPresignedPutObjectUrl = async (
  input: PresignedPutObjectInput,
): Promise<string> => {
  const configuration = getObjectStorageConfiguration();
  return getSignedUrl(
    getS3Client(configuration),
    new PutObjectCommand({
      Bucket: configuration.bucket,
      Key: input.key,
      ContentType: input.contentType,
      CacheControl: input.cacheControl ?? OBJECT_STORAGE_CACHE_CONTROL,
    }),
    { expiresIn: OBJECT_STORAGE_UPLOAD_URL_EXPIRES_SECONDS },
  );
};

export const headObject = async (key: string): Promise<HeadObjectCommandOutput> => {
  const configuration = getObjectStorageConfiguration();
  return getS3Client(configuration).send(
    new HeadObjectCommand({
      Bucket: configuration.bucket,
      Key: key,
    }),
  );
};

/** Reads an object, or the byte range a browser asked for (`bytes=0-99`), as S3 answers it. */
export const getObject = async (key: string, range?: string): Promise<GetObjectCommandOutput> => {
  const configuration = getObjectStorageConfiguration();
  return getS3Client(configuration).send(
    new GetObjectCommand({ Bucket: configuration.bucket, Key: key, Range: range }),
  );
};

export const deleteObject = async (key: string): Promise<void> => {
  const configuration = getObjectStorageConfiguration();
  await getS3Client(configuration).send(
    new DeleteObjectCommand({
      Bucket: configuration.bucket,
      Key: key,
    }),
  );
};

export const buildPublicObjectUrl = (key: string): string => {
  const configuration = getObjectStorageConfiguration();
  const baseUrl = new URL(
    `${configuration.bucket}/`,
    configuration.endpoint.endsWith('/') ? configuration.endpoint : `${configuration.endpoint}/`,
  );
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  return new URL(encodedKey, baseUrl).toString();
};
