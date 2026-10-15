import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import { config } from "dotenv";
config({ path: ".env.sites.local", quiet: true });
const secret = process.env.SGI_SITES_GATEWAY_KEY;
if (!secret || secret.length < 32)
  throw new Error("SGI_SITES_GATEWAY_KEY is required.");
const hopHeaders = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
];
const server = http.createServer((request, response) => {
  const supplied = request.headers["x-sgi-gateway-key"];
  const valid =
    typeof supplied === "string" &&
    Buffer.byteLength(supplied) === Buffer.byteLength(secret) &&
    timingSafeEqual(Buffer.from(supplied), Buffer.from(secret));
  if (!valid) {
    response.writeHead(403, { "Cache-Control": "no-store" });
    response.end("Forbidden");
    return;
  }
  const headers = { ...request.headers, host: "localhost:4310" };
  delete headers["x-sgi-gateway-key"];
  delete headers["x-forwarded-host"];
  for (const key of hopHeaders) delete headers[key];
  const upstream = http.request(
    {
      hostname: "127.0.0.1",
      port: 4310,
      path: request.url,
      method: request.method,
      headers,
    },
    (origin) => {
      const resultHeaders = { ...origin.headers };
      for (const key of hopHeaders) delete resultHeaders[key];
      response.writeHead(origin.statusCode || 502, resultHeaders);
      origin.pipe(response);
    },
  );
  upstream.on("error", () => {
    if (!response.headersSent)
      response.writeHead(503, { "Cache-Control": "no-store" });
    response.end("Layanan belum tersedia. Coba lagi.");
  });
  request.on("aborted", () => upstream.destroy());
  request.pipe(upstream);
});
server.listen(4311, "127.0.0.1", () =>
  console.log("SGI Sites gateway: http://127.0.0.1:4311"),
);
