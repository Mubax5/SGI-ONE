"use client";
import { Empty, Button } from "@cloudflare/kumo";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <Empty
      className="empty"
      title="Aplikasi belum dapat memuat data"
      description="Periksa koneksi server, lalu coba kembali."
      contents={<Button onClick={reset}>Coba kembali</Button>}
    />
  );
}
