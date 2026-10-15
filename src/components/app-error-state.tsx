"use client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Badge, Button, LinkButton, Text } from "@cloudflare/kumo";
import {
  ArrowLeftIcon,
  ArrowClockwiseIcon,
  HouseIcon,
  MagnifyingGlassIcon,
  ShieldCheckIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";

const states = {
  "not-found": {
    code: "404",
    title: "Halaman tidak ditemukan",
    description: "Periksa alamat halaman atau kembali ke dashboard.",
    icon: MagnifyingGlassIcon,
  },
  forbidden: {
    code: "Akses terbatas",
    title: "Halaman ini belum dapat Anda akses",
    description: "Hubungi administrator jika Anda memerlukan akses.",
    icon: ShieldCheckIcon,
  },
  error: {
    code: "Gagal memuat",
    title: "Halaman belum dapat dimuat",
    description: "Coba muat ulang halaman ini.",
    icon: WarningCircleIcon,
  },
};
export function AppErrorState({
  kind,
  fullPage = false,
  onRetry,
}: {
  kind: keyof typeof states;
  fullPage?: boolean;
  onRetry?: () => void;
}) {
  const router = useRouter();
  const state = states[kind];
  const Icon = state.icon;
  return (
    <section
      className={`app-error-state${fullPage ? " app-error-page" : ""}`}
      aria-labelledby="app-error-title"
    >
      {fullPage && (
        <header className="app-error-brand">
          <Image src="/favicon-sgi.png" alt="SGI" width={32} height={32} />
          <Text as="span" bold>
            SGI One
          </Text>
        </header>
      )}
      <div className="app-error-content">
        <div className="app-error-icon" aria-hidden="true">
          <Icon size={28} />
        </div>
        <Badge variant="secondary">{state.code}</Badge>
        <Text
          as="h1"
          variant="heading"
          DANGEROUS_className="app-error-title"
          id="app-error-title"
        >
          {state.title}
        </Text>
        <Text variant="secondary">{state.description}</Text>
        <div className="app-error-actions">
          {onRetry ? (
            <Button
              variant="primary"
              icon={<ArrowClockwiseIcon size={18} />}
              onClick={onRetry}
            >
              Coba lagi
            </Button>
          ) : (
            <LinkButton
              variant="primary"
              href="/home"
              icon={<HouseIcon size={18} />}
            >
              Buka dashboard
            </LinkButton>
          )}
          {onRetry ? (
            <LinkButton href="/home" variant="outline">
              Buka dashboard
            </LinkButton>
          ) : (
            <Button
              variant="outline"
              icon={<ArrowLeftIcon size={18} />}
              onClick={() =>
                window.history.length > 1
                  ? router.back()
                  : router.replace("/home")
              }
            >
              Kembali
            </Button>
          )}
        </div>
      </div>
      {fullPage && (
        <footer className="app-error-footer">
          <Text variant="secondary">Sandika Global Indonesia</Text>
        </footer>
      )}
    </section>
  );
}
