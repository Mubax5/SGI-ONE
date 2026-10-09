"use client";
import { Button } from "@cloudflare/kumo";
export function PrintButton() {
  return (
    <Button
      className="no-print"
      onClick={() => window.print()}
      variant="primary"
    >
      Cetak / simpan sebagai PDF
    </Button>
  );
}
