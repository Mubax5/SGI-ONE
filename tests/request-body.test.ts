import { expect, it } from "vitest";
import { limitedBody, limitedJson } from "@/lib/request-body";
it("limits chunked uploads even without content length", async () => {
  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      c.enqueue(new Uint8Array(8));
      c.enqueue(new Uint8Array(8));
      c.close();
    },
  });
  const request = new Request("http://localhost", {
    method: "POST",
    body: stream,
    duplex: "half",
  } as RequestInit);
  await expect(limitedBody(request, 10)).rejects.toMatchObject({ status: 413 });
});
it("returns actionable errors for malformed JSON", async () => {
  const request = new Request("http://localhost", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{",
  });
  await expect(limitedJson(request)).rejects.toThrow("JSON tidak valid");
});
