"use client";
import { Button, Text } from "@cloudflare/kumo";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Modal, Feedback } from "./shared";
import { workspaceHeaders } from "@/lib/live-data";
import { LoadingState } from "./workspace-ui";
import Image from "next/image";
import type { PDFDocumentLoadingTask } from "pdfjs-dist";
export function DocumentPreview({
  document,
  onClose,
}: {
  document: { id: string; filename: string } | null;
  onClose: () => void;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy>();
  const [image, setImage] = useState("");
  const [page, setPage] = useState(1);
  const [renderedPage, setRenderedPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null),
    panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!document) return;
    const controller = new AbortController();
    let url = "",
      loader: PDFDocumentLoadingTask | undefined;
    const task = window.setTimeout(async () => {
      setBusy(true);
      setError("");
      setPage(1);
      setRenderedPage(0);
      setPdf(undefined);
      setImage("");
      try {
        const response = await fetch(`/api/documents/${document.id}/preview`, {
          headers: workspaceHeaders(),
          signal: controller.signal,
        });
        if (!response.ok)
          throw new Error(
            (await response.json()).error || "Dokumen gagal dimuat. Coba lagi.",
            { cause: "document-response" },
          );
        const blob = await response.blob();
        if (blob.type === "application/pdf") {
          const engine = await import("pdfjs-dist");
          engine.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
          const bytes = new Uint8Array(await blob.arrayBuffer());
          if (controller.signal.aborted) return;
          loader = engine.getDocument({
            data: bytes,
            cMapUrl: "/pdfjs/cmaps/",
            cMapPacked: true,
            standardFontDataUrl: "/pdfjs/standard_fonts/",
            wasmUrl: "/pdfjs/wasm/",
          });
          const loaded = await loader.promise;
          if (controller.signal.aborted) return;
          setPdf(loaded);
        } else if (blob.type.startsWith("image/")) {
          url = URL.createObjectURL(blob);
          if (!controller.signal.aborted) setImage(url);
        } else throw new Error("Format dokumen tidak didukung.");
      } catch (e) {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error && e.cause === "document-response"
              ? e.message
              : "Dokumen tidak dapat dibuka. Periksa file dan coba lagi.",
          );
      } finally {
        if (!controller.signal.aborted) setBusy(false);
      }
    }, 0);
    return () => {
      window.clearTimeout(task);
      controller.abort();
      if (url) URL.revokeObjectURL(url);
      void loader?.destroy().catch(() => {});
    };
  }, [document]);
  useEffect(() => {
    if (!document || !pdf || !canvas.current || !panel.current) return;
    const target = canvas.current;
    let disposed = false;
    let generation = 0;
    let render:
      | ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]>
      | undefined;
    async function draw() {
      const current = ++generation;
      render?.cancel();
      await render?.promise.catch(() => {});
      try {
        if (disposed || current !== generation) return;
        const p = await pdf!.getPage(page);
        if (disposed || current !== generation) return;
        const width = panel.current!.clientWidth;
        const ratio = window.devicePixelRatio || 1;
        const viewport = p.getViewport({
          scale: (width / p.getViewport({ scale: 1 }).width) * ratio,
        });
        target.width = viewport.width;
        target.height = viewport.height;
        target.style.width = `${width}px`;
        render = p.render({ canvas: target, viewport });
        await render.promise;
        if (!disposed && current === generation) {
          setError("");
          setRenderedPage(page);
        }
      } catch (e) {
        if (
          !disposed &&
          current === generation &&
          !(e instanceof Error && e.name === "RenderingCancelledException")
        )
          setError("Halaman PDF gagal ditampilkan. Buka kembali dokumen.");
      }
    }
    const observer = new ResizeObserver(() => void draw());
    observer.observe(panel.current);
    void draw();
    return () => {
      disposed = true;
      observer.disconnect();
      render?.cancel();
    };
  }, [pdf, page, document]);
  return (
    <Modal
      open={!!document}
      onClose={onClose}
      title="Preview dokumen"
      description={document?.filename}
    >
      <div className="detail-body document-preview" ref={panel}>
        <Feedback error={error} />
        {busy && <LoadingState text="Memuat dokumen…" />}
        {image && (
          <Image
            src={image}
            width={1600}
            height={2000}
            unoptimized
            alt={document?.filename || "Dokumen"}
          />
        )}
        {pdf && (
          <>
            <div className="document-page-controls">
              <Button
                disabled={page <= 1 || renderedPage !== page}
                onClick={() => setPage((v) => v - 1)}
              >
                Sebelumnya
              </Button>
              <Text>
                {page}/{pdf.numPages}
              </Text>
              <Button
                disabled={page >= pdf.numPages || renderedPage !== page}
                onClick={() => setPage((v) => v + 1)}
              >
                Berikutnya
              </Button>
            </div>
            <div className="pdf-page-surface">
              <canvas
                ref={canvas}
                aria-label={`Halaman ${page} dari ${pdf.numPages}`}
                role="img"
                aria-busy={renderedPage !== page}
              />
              {renderedPage !== page && (
                <div className="pdf-render-status">
                  <LoadingState text="Memuat halaman…" />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
