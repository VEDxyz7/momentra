import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const awsEnabled = Boolean(process.env.AWS_REGION && process.env.S3_BUCKET_ORIGINALS);

const s3 = awsEnabled
  ? new S3Client({ region: process.env.AWS_REGION })
  : null;

export function storageMode() {
  return awsEnabled ? "s3" : "local";
}

export async function putObject({ buffer, key, contentType, localRoot }) {
  if (awsEnabled) {
    await s3.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_ORIGINALS,
      Key: key,
      Body: buffer,
      ContentType: contentType
    }));
    return {
      mode: "s3",
      key,
      url: process.env.CLOUDFRONT_URL ? `${process.env.CLOUDFRONT_URL}/${key}` : `s3://${process.env.S3_BUCKET_ORIGINALS}/${key}`
    };
  }

  const filePath = path.join(localRoot, key);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, buffer);
  return { mode: "local", key, url: `/uploads/${key}` };
}

export async function getObjectBuffer({ key, localRoot }) {
  if (awsEnabled) {
    const object = await s3.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET_ORIGINALS, Key: key }));
    return Buffer.from(await object.Body.transformToByteArray());
  }
  return readFile(path.join(localRoot, key));
}

export async function signedReadUrl(key, expiresIn = 300) {
  if (!awsEnabled) return null;
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: process.env.S3_BUCKET_ORIGINALS, Key: key }),
    { expiresIn }
  );
}

export async function signedWriteUrl({ key, contentType, expiresIn = 300 }) {
  if (!awsEnabled) return null;
  return getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: process.env.S3_BUCKET_ORIGINALS, Key: key, ContentType: contentType }),
    { expiresIn }
  );
}
