import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { DomainError } from "./domain";
export function storageConfigured() {
  return [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET",
  ].every((k) => Boolean(process.env[k]));
}
function storage() {
  if (!storageConfigured())
    throw new DomainError(
      "Penyimpanan belum terhubung. Administrator perlu mengisi konfigurasi R2 di server, lalu restart aplikasi.",
      503,
    );
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const allowedFiles: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
export function validateFile(name: string, type: string, data: Uint8Array) {
  if (
    !name ||
    name.length > 160 ||
    /[\\/]/.test(name) ||
    [...name].some((c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)
  )
    throw new DomainError(
      "Nama file tidak valid. Gunakan nama pendek tanpa karakter khusus.",
    );
  if (
    !Object.hasOwn(allowedFiles, type) ||
    !data.length ||
    data.length > MAX_FILE_SIZE
  )
    throw new DomainError(
      "Unggah PDF, JPG, PNG, atau WebP dengan ukuran maksimal 10 MB.",
    );
  const valid =
    type === "application/pdf"
      ? new TextDecoder().decode(data.slice(0, 5)) === "%PDF-"
      : type === "image/png"
        ? [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => data[i] === b)
        : type === "image/webp"
          ? data.length >= 12 &&
            new TextDecoder().decode(data.slice(0, 4)) === "RIFF" &&
            new TextDecoder().decode(data.slice(8, 12)) === "WEBP"
          : data[0] === 255 && data[1] === 216 && data[2] === 255;
  const ext = name.toLowerCase().split(".").pop();
  const validExt =
    type === "image/jpeg"
      ? ["jpg", "jpeg"].includes(ext ?? "")
      : ext === allowedFiles[type].slice(1);
  if (!valid || !validExt)
    throw new DomainError("Isi file dan ekstensi tidak sesuai tipe dokumen.");
}
export async function putFile(key: string, type: string, data: Uint8Array) {
  try {
    await storage().send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET!,
        Key: key,
        Body: data,
        ContentType: type,
        CacheControl: "private, no-store",
      }),
    );
  } catch (e) {
    if (e instanceof DomainError) throw e;
    console.error("R2 upload failed", e instanceof Error ? e.name : "unknown");
    throw new DomainError(
      "Unggah ke R2 gagal. Coba kembali; dokumen belum disimpan.",
      502,
    );
  }
}
export async function deleteFile(key: string) {
  await storage().send(
    new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }),
  );
}
export async function getFile(key: string) {
  try {
    const object = await storage().send(
      new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }),
    );
    if (!object.Body) throw new Error("Empty object");
    return await object.Body.transformToByteArray();
  } catch (e) {
    if (e instanceof DomainError) throw e;
    console.error(
      "R2 download failed",
      e instanceof Error ? e.name : "unknown",
    );
    throw new DomainError(
      "Dokumen tidak dapat diambil dari R2. Coba lagi atau hubungi Operations.",
      502,
    );
  }
}
