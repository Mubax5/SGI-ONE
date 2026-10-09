import { Empty, LinkButton } from "@cloudflare/kumo";
export default function NotFound() {
  return (
    <Empty
      className="empty"
      title="Halaman tidak ditemukan"
      description="Data tidak tersedia atau belum ditugaskan kepada Anda."
      contents={
        <LinkButton href="/" variant="primary">
          Kembali ke workspace
        </LinkButton>
      }
    />
  );
}
