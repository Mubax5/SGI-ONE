import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import "./workspace.css";
export const metadata: Metadata = {
  icons: {
    icon: [{ url: "/favicon-sgi.png", type: "image/png" }],
    shortcut: "/favicon-sgi.png",
  },
  title: "SGI One | Sandika Global Indonesia",
  description:
    "Pengelolaan operasi logistik, dokumen, dan penagihan internal SGI.",
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id" data-mode="light" data-theme="sgi">
      <body>
        <div id="app-root">{children}</div>
      </body>
    </html>
  );
}
