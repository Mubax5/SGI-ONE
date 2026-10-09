import { describe, expect, it } from "vitest";
import { validateFile, storageConfigured, MAX_FILE_SIZE } from "@/lib/storage";
describe("Private document validation", () => {
  const pdf = new TextEncoder().encode("%PDF-1.7\nfixture");
  it("accepts allowed file signature and extension", () => {
    expect(() =>
      validateFile("surat-jalan.pdf", "application/pdf", pdf),
    ).not.toThrow();
  });
  it("accepts supported report image signatures and rejects RIFF non-WebP", () => {
    expect(() =>
      validateFile(
        "foto.png",
        "image/png",
        new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      ),
    ).not.toThrow();
    expect(() =>
      validateFile(
        "foto.jpg",
        "image/jpeg",
        new Uint8Array([255, 216, 255, 224]),
      ),
    ).not.toThrow();
    expect(() =>
      validateFile(
        "foto.webp",
        "image/webp",
        new TextEncoder().encode("RIFF0000WEBP"),
      ),
    ).not.toThrow();
    expect(() =>
      validateFile(
        "audio.webp",
        "image/webp",
        new TextEncoder().encode("RIFF0000WAVE"),
      ),
    ).toThrow();
    expect(() =>
      validateFile("kosong.png", "image/png", new Uint8Array()),
    ).toThrow();
  });
  it("rejects filename paths and control characters", () => {
    expect(() =>
      validateFile("../../file.pdf", "application/pdf", pdf),
    ).toThrow();
    expect(() =>
      validateFile("bad\nfile.pdf", "application/pdf", pdf),
    ).toThrow();
  });
  it("rejects spoofed MIME, extension, executable and oversize files", () => {
    expect(() =>
      validateFile(
        "file.pdf",
        "application/pdf",
        new TextEncoder().encode("<script>"),
      ),
    ).toThrow();
    expect(() => validateFile("file.exe", "application/pdf", pdf)).toThrow();
    expect(() =>
      validateFile("file.exe", "application/octet-stream", pdf),
    ).toThrow();
    expect(() =>
      validateFile(
        "file.pdf",
        "application/pdf",
        new Uint8Array(MAX_FILE_SIZE + 1),
      ),
    ).toThrow();
  });
  it("fails closed for missing configuration", () => {
    const old = process.env.R2_ACCOUNT_ID;
    delete process.env.R2_ACCOUNT_ID;
    expect(storageConfigured()).toBe(false);
    if (old) process.env.R2_ACCOUNT_ID = old;
  });
});
