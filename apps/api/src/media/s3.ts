import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export function getMediaBucketName() {
  const name = process.env.MEDIA_BUCKET_NAME;
  if (!name) throw new Error("Missing env: MEDIA_BUCKET_NAME");
  return name;
}

export function getS3() {
  return new S3Client({ region: process.env.AWS_REGION });
}

export async function signPutObject(params: {
  key: string;
  contentType: string;
  contentLength: number;
  expiresSeconds: number;
}) {
  const s3 = getS3();
  const bucket = getMediaBucketName();

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: params.key,
    ContentType: params.contentType,
    ContentLength: params.contentLength,
  });

  return await getSignedUrl(s3, command, { expiresIn: params.expiresSeconds });
}

export async function signGetObject(params: { key: string; expiresSeconds: number }) {
  const s3 = getS3();
  const bucket = getMediaBucketName();
  const command = new GetObjectCommand({ Bucket: bucket, Key: params.key });
  return await getSignedUrl(s3, command, { expiresIn: params.expiresSeconds });
}

export async function deleteObject(params: { key: string }) {
  const s3 = getS3();
  const bucket = getMediaBucketName();
  await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: params.key }));
}

