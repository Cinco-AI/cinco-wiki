import { Hono } from "hono";
import { z } from "zod";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { IMAGE_MIME, LIMITS, type PresignUploadResult } from "@cinco-wiki/shared";
import { body, errors, type AppEnv } from "../lib/http.js";
import { env } from "../lib/env.js";

export const uploadsRoutes = new Hono<AppEnv>();

/** Durée de validité de l'URL pré-signée PUT (secondes). */
const PRESIGN_TTL = 300;

/** Client S3 réutilisé entre invocations Lambda. */
let s3: S3Client | null = null;
function getS3(): S3Client {
  if (!s3) s3 = new S3Client({ region: env.region });
  return s3;
}

const presignSchema = z.object({
  filename: z.string().min(1).max(255),
  contentType: z.enum([...IMAGE_MIME]),
  size: z.number().int().positive(),
});

/** Réduit un nom de fichier à un basename sûr pour une clé S3. */
function safeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^\.+/, "");
  return cleaned || "file";
}

// POST /uploads/presign — URL pré-signée PUT S3 pour une image de note (§uploads.ts).
uploadsRoutes.post("/presign", async (c) => {
  const { filename, contentType, size } = await body(c, presignSchema);

  if (!IMAGE_MIME.includes(contentType)) {
    throw errors.badRequest("Type d'image non autorisé");
  }
  if (size > LIMITS.imageMaxBytes) {
    throw errors.badRequest(
      `Fichier trop volumineux (max ${LIMITS.imageMaxBytes} octets)`,
    );
  }

  const userId = c.get("userId");
  const key = `notes/${userId}/${globalThis.crypto.randomUUID()}-${safeFilename(filename)}`;

  const uploadUrl = await getSignedUrl(
    getS3(),
    new PutObjectCommand({
      Bucket: env.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
    }),
    { expiresIn: PRESIGN_TTL },
  );

  const publicUrl = `https://${env.bucket}.s3.${env.region}.amazonaws.com/${key}`;

  const result: PresignUploadResult = { uploadUrl, publicUrl };
  return c.json(result);
});
