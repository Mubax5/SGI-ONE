import { DomainError } from "./domain";
// Limit the stream itself, including chunked uploads without Content-Length.
export async function limitedBody(
  request: Request,
  limit: number,
): Promise<Buffer> {
  if (Number(request.headers.get("content-length") ?? 0) > limit)
    throw new DomainError("Ukuran permintaan terlalu besar.", 413);
  if (!request.body) throw new DomainError("Isi permintaan wajib diisi.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new DomainError("Ukuran permintaan terlalu besar.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
export async function limitedJson(request: Request) {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new DomainError("Gunakan format JSON untuk permintaan ini.", 415);
  const bytes = await limitedBody(request, 1000000);
  try {
    return JSON.parse(bytes.toString("utf8")) as unknown;
  } catch {
    throw new DomainError("Isi JSON tidak valid.");
  }
}
export async function limitedForm(request: Request) {
  if (!request.headers.get("content-type")?.includes("multipart/form-data"))
    throw new DomainError("Gunakan formulir unggah untuk dokumen.", 415);
  const bytes = await limitedBody(request, 11 * 1024 * 1024);
  const bounded = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: new Blob([new Uint8Array(bytes)]),
  });
  try {
    return await bounded.formData();
  } catch {
    throw new DomainError("Formulir unggah tidak valid.");
  }
}
