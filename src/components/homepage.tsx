"use client";
import Image from "next/image";
import {
  Badge,
  Button,
  Checkbox,
  LayerCard,
  LinkButton,
  Select,
  Text,
  useSidebar,
} from "@cloudflare/kumo";
import {
  ArrowRightIcon,
  BellIcon,
  DotsNineIcon,
  GearSixIcon,
  MapTrifoldIcon,
  PencilSimpleIcon,
  SignOutIcon,
  TruckIcon,
  CheckCircleIcon,
  UsersIcon,
  FilesIcon,
  ReceiptIcon,
  CoinsIcon,
  WalletIcon,
  BuildingsIcon,
  PackageIcon,
  NotePencilIcon,
  ShieldCheckIcon,
  UserCircleIcon,
  UserMinusIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Actor, can, Role, roleLabels } from "@/lib/domain";
import { homeSummary } from "@/lib/home-summary";
import type { WorkspaceData } from "@/modules/workspace";
import type { Serialized } from "./types";
import { navigation } from "./navigation";
import { SearchTrigger } from "./global-search";
import { api, Feedback, Modal, Refresh } from "./shared";
import { LoadingState } from "./workspace-ui";
import { RoleDashboard } from "./role-dashboard";
const defaults: Record<Role, string[]> = {
  field: ["/jobs", "/reports", "/documents", "/maps", "/attendance"],
  operations: ["/jobs", "/reports", "/documents", "/maps", "/analytics"],
  finance: ["/invoices", "/billing", "/payments", "/customers", "/analytics"],
  director: ["/jobs", "/invoices", "/payments", "/maps", "/analytics"],
  sales: [
    "/customers",
    "/requests",
    "/quotations",
    "/analytics",
    "/attendance",
  ],
  admin: ["/users", "/audit", "/analytics", "/attendance"],
};
const statusIcons = {
  operations: [FilesIcon, TruckIcon, CheckCircleIcon, UsersIcon],
  field: [FilesIcon, TruckIcon, CheckCircleIcon, UsersIcon],
  finance: [ReceiptIcon, NotePencilIcon, CheckCircleIcon, WalletIcon],
  director: [TruckIcon, FilesIcon, ReceiptIcon, CoinsIcon],
  sales: [BuildingsIcon, PackageIcon, NotePencilIcon, CheckCircleIcon],
  admin: [UsersIcon, UserCircleIcon, UserMinusIcon, ShieldCheckIcon],
};
const subscribe = (fn: () => void) => {
  window.addEventListener("sgi-home-preferences", fn);
  window.addEventListener("storage", fn);
  return () => {
    window.removeEventListener("sgi-home-preferences", fn);
    window.removeEventListener("storage", fn);
  };
};
export function Homepage({ actor, role }: { actor: Actor; role: Role }) {
  const { isMobile } = useSidebar();
  return isMobile ? (
    <MobileHomepage actor={actor} role={role} />
  ) : (
    <RoleDashboard actor={actor} role={role} presentation="dashboard" />
  );
}
function MobileHomepage({ actor, role }: { actor: Actor; role: Role }) {
  const router = useRouter();
  const featuresRef = useRef<HTMLElement>(null);
  const key = `sgi.home.${actor.id}.${role}`;
  const preference = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(key) ?? "{}";
      } catch {
        return "{}";
      }
    },
    () => "{}",
  );
  let saved: { favorites?: string[]; dismissed?: boolean } = {};
  try {
    saved = JSON.parse(preference);
  } catch {
    /* Ignore malformed device preferences. */
  }
  const menus = navigation.filter(
    (n) =>
      n.href !== "/home" &&
      (!n.permission || can({ ...actor, roles: [role] }, n.permission)),
  );
  const allowed = new Set(menus.map((n) => n.href));
  const favorites = (
    Array.isArray(saved?.favorites) ? saved.favorites : defaults[role]
  )
    .filter((h) => allowed.has(h))
    .slice(0, 5);
  const [data, setData] = useState<Serialized<WorkspaceData>>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [dialog, setDialog] = useState<
    "alerts" | "settings" | "favorites" | null
  >(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    api<Serialized<WorkspaceData>>(`data/dashboard?role=${role}`)
      .then((result) => {
        if (result.role !== role)
          throw new Error("Role berubah. Muat ulang homepage.");
        if (alive) {
          setData(result);
          setError("");
        }
      })
      .catch((e) => {
        if (alive) setError(e.message);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [role, revision]);
  function save(value: typeof saved) {
    try {
      localStorage.setItem(key, JSON.stringify({ ...saved, ...value }));
      window.dispatchEvent(new Event("sgi-home-preferences"));
    } catch {
      setError(
        "Preferensi tidak dapat disimpan di perangkat ini. Izinkan penyimpanan browser dan coba lagi.",
      );
      return false;
    }
    return true;
  }
  function edit() {
    setSelection(favorites);
    setDialog("favorites");
  }
  async function logout() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error("Keluar gagal. Coba lagi.");
      window.location.assign("/login");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Keluar gagal.");
    } finally {
      setBusy(false);
    }
  }
  const view = data ? homeSummary(data) : null;
  const href = (path: string) => {
    const url = new URL(path, "http://sgi.local");
    url.searchParams.set("role", role);
    return url.pathname + url.search + url.hash;
  };
  function shortcut(menu: (typeof menus)[number]) {
    const Icon = menu.icon;
    return (
      <LinkButton
        key={menu.href}
        aria-label={menu.label}
        href={href(menu.href)}
        variant="ghost"
        className="home-shortcut"
      >
        <span className="home-shortcut-icon">
          <Icon size={25} weight="duotone" />
        </span>
        <span>{menu.shortLabel}</span>
      </LinkButton>
    );
  }
  return (
    <div className="sgi-homepage" data-workspace-role={role}>
      <div className="home-top">
        <header className="home-brand-row">
          <div className="home-wordmark">
            <Image
              src="/sgi-logo.png"
              alt="SGI"
              width={943}
              height={784}
              sizes="34px"
            />
            <h1>
              SGI One<span className="sr-only"> · Homepage</span>
            </h1>
          </div>
          <div className="home-header-actions">
            <Button
              variant="ghost"
              shape="circle"
              icon={<DotsNineIcon size={23} />}
              aria-label="Lihat seluruh fitur"
              onClick={() =>
                featuresRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
            />
            <Button
              variant="ghost"
              shape="circle"
              icon={<BellIcon size={23} />}
              aria-label="Pemberitahuan pekerjaan"
              onClick={() => setDialog("alerts")}
            />
            <Button
              variant="ghost"
              shape="circle"
              icon={<GearSixIcon size={23} />}
              aria-label="Pengaturan homepage dan akun"
              onClick={() => setDialog("settings")}
            />
          </div>
        </header>
        <SearchTrigger className="home-search" />
        <nav className="home-shortcuts" aria-label="Menu favorit" id="favorit">
          {favorites
            .map((h) => menus.find((m) => m.href === h))
            .filter((m): m is (typeof menus)[number] => Boolean(m))
            .map(shortcut)}
          {favorites.length === 0 && (
            <Button
              variant="ghost"
              icon={<PencilSimpleIcon size={24} />}
              onClick={edit}
            >
              Pilih favorit
            </Button>
          )}
        </nav>
        {view && !saved?.dismissed && (
          <div className="home-notice">
            <BellIcon size={26} weight="duotone" />
            <div>
              <Text as="h2">{view.title}</Text>
              <Text as="p">{view.notice}</Text>
            </div>
            <Button
              variant="ghost"
              shape="circle"
              aria-label="Tutup ringkasan perhatian"
              icon={<XIcon size={19} />}
              onClick={() => save({ dismissed: true })}
            />
          </div>
        )}
      </div>
      <section className="home-sheet" aria-label="Aktivitas dan fitur">
        <Feedback error={error} />
        {loading ? (
          <LoadingState text="Memuat homepage Anda…" />
        ) : (
          view && (
            <>
              <div className="home-summary-grid">
                {view.summary.map((item) => (
                  <LinkButton
                    href={href(item.href)}
                    variant="ghost"
                    className="home-summary"
                    key={item.label}
                  >
                    <span className="home-summary-symbol">
                      {(() => {
                        const Icon =
                          navigation.find(
                            (m) => m.href === item.href.split(/[?#]/)[0],
                          )?.icon ?? ReceiptIcon;
                        return <Icon size={24} weight="duotone" />;
                      })()}
                    </span>
                    <span>
                      <strong>{item.value}</strong>
                      <Text as="span" variant="secondary">
                        {item.label}
                      </Text>
                    </span>
                  </LinkButton>
                ))}
              </div>
              <LayerCard className="home-status-card">
                <div className="home-status-grid">
                  {view.statuses.map((item, index) => {
                    const Icon = statusIcons[role][index];
                    return (
                      <LinkButton
                        variant="ghost"
                        href={href(item.href)}
                        key={item.label}
                      >
                        <span className="home-status-icon-count">
                          <Icon size={24} weight="duotone" />
                          <Badge variant="secondary">{item.value}</Badge>
                        </span>
                        <span>{item.label}</span>
                      </LinkButton>
                    );
                  })}
                </div>
                <LinkButton
                  variant="ghost"
                  href={href(view.href)}
                  className="home-status-action"
                  icon={<ArrowRightIcon size={21} />}
                >
                  {view.action}
                </LinkButton>
              </LayerCard>
            </>
          )
        )}
        <section
          className="home-feature-section"
          ref={featuresRef}
          aria-labelledby="home-features-title"
        >
          <div className="home-section-heading">
            <Text as="h2" id="home-features-title">
              Seluruh fitur
            </Text>
            <Button
              variant="ghost"
              size="sm"
              icon={<PencilSimpleIcon size={15} />}
              onClick={edit}
            >
              Atur favorit
            </Button>
          </div>
          <nav
            className="home-shortcuts home-all-features"
            aria-label="Seluruh fitur homepage"
          >
            {menus.map(shortcut)}
          </nav>
        </section>
        {view && (
          <LayerCard className="home-context-card">
            <div>
              <Text as="h2">{view.subtitle}</Text>
              <Text variant="secondary">
                {roleLabels[role]} · {actor.name}
              </Text>
            </div>
            {allowed.has("/maps") ? (
              <LinkButton
                href={href("/maps")}
                variant="primary"
                icon={<MapTrifoldIcon size={20} />}
              >
                Buka peta pekerjaan
              </LinkButton>
            ) : (
              <LinkButton href={href("/analytics")} variant="primary">
                Buka analitik
              </LinkButton>
            )}
          </LayerCard>
        )}
        <div className="home-refresh">
          <span>Data operasional tersimpan · simulasi demo</span>
          <Refresh
            loading={loading}
            onClick={() => {
              setLoading(true);
              setRevision((r) => r + 1);
            }}
          />
        </div>
      </section>
      <Modal
        open={dialog === "alerts"}
        onClose={() => setDialog(null)}
        title="Perlu perhatian"
        description="Ringkasan dari data workspace Anda saat ini."
      >
        {view ? (
          <>
            <Text>{view.notice}</Text>
            <LinkButton variant="primary" href={href(view.href)}>
              {view.action}
            </LinkButton>
            <div className="home-alert-links">
              {view.summary.map((item) => (
                <LinkButton
                  key={item.label}
                  variant="outline"
                  href={href(item.href)}
                >
                  {item.label}: {item.value}
                </LinkButton>
              ))}
            </div>
          </>
        ) : (
          <Text>Data belum tersedia. Tutup dan muat ulang homepage.</Text>
        )}
      </Modal>
      <Modal
        open={dialog === "settings"}
        onClose={() => setDialog(null)}
        title="Akun dan homepage"
        description="Preferensi homepage disimpan pada perangkat ini."
      >
        <Text as="h2">{actor.name}</Text>
        <Text variant="secondary">{actor.email}</Text>
        <Select<Role>
          label="Workspace role"
          value={role}
          items={Object.fromEntries(actor.roles.map((r) => [r, roleLabels[r]]))}
          onValueChange={(r) => {
            if (r) router.push(`/home?role=${r}`);
          }}
        />
        <Button
          variant="outline"
          icon={<PencilSimpleIcon size={18} />}
          onClick={edit}
        >
          Atur menu favorit
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            if (save({ dismissed: false })) setDialog(null);
          }}
        >
          Tampilkan ringkasan perhatian
        </Button>
        <Button
          variant="primary"
          icon={<SignOutIcon size={18} />}
          loading={busy}
          onClick={logout}
        >
          Keluar akun
        </Button>
      </Modal>
      <Modal
        open={dialog === "favorites"}
        onClose={() => setDialog(null)}
        title="Menu favorit"
        description="Pilih hingga 5 fitur untuk akses cepat di bagian atas homepage."
      >
        <div className="home-favorite-options">
          {menus.map((menu) => (
            <Checkbox
              key={menu.href}
              label={menu.label}
              checked={selection.includes(menu.href)}
              disabled={selection.length >= 5 && !selection.includes(menu.href)}
              onCheckedChange={(checked) =>
                setSelection((values) =>
                  checked
                    ? [...values, menu.href]
                    : values.filter((h) => h !== menu.href),
                )
              }
            />
          ))}
        </div>
        <Button
          variant="primary"
          onClick={() => {
            if (save({ favorites: selection })) setDialog(null);
          }}
        >
          Simpan favorit
        </Button>
      </Modal>
    </div>
  );
}
