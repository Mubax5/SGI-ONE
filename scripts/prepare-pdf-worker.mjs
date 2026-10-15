import { copyFileSync, cpSync, mkdirSync } from "node:fs";
copyFileSync(
  "node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
  "public/pdf.worker.min.mjs",
);
mkdirSync("public/pdfjs", { recursive: true });
for (const directory of ["cmaps", "standard_fonts", "wasm"])
  cpSync(`node_modules/pdfjs-dist/${directory}`, `public/pdfjs/${directory}`, {
    recursive: true,
  });
