"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Badge,
  Button,
  Checkbox,
  LayerCard,
  LinkButton,
  Select,
  Text,
} from "@cloudflare/kumo";
import {
  ArrowClockwiseIcon,
  ArrowRightIcon,
  BellIcon,
  CaretRightIcon,
  GearSixIcon,
  PencilSimpleIcon,
  SignOutIcon,
  XIcon,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Actor, can, Role, roleLabels } from "@/lib/domain";
import { homeSummary } from "@/lib/home-summary";
import type { WorkspaceData } from "@/modules/workspace";
import type { Serialized } from "./types";
import { navigation } from "./navigation";
import { SearchTrigger } from "./global-search";
import { api, Feedback, Modal } from "./shared";
import { LoadingState } from "./workspace-ui";

/** Small mobile-native surfaces; desktop keeps the original Kumo dashboard. */
const quickRoutes: Record<Role, string[]> = {
  operations: ["/reports?create=1", "/jobs", "/documents", "/maps"],
  field: ["/reports?create=1", "/jobs", "/documents", "/attendance"],
  finance: ["/invoices?create=1", "/payments", "/billing", "/customers"],
  director: ["/analytics", "/jobs", "/invoices", "/payments"],
  sales: ["/requests?create=1", "/customers", "/quotations", "/attendance"],
  admin: ["/users?create=1", "/audit", "/attendance", "/analytics"],
};

const defaultFavorites: Record<Role, string[]> = {
  operations: ["/jobs", "/reports", "/documents", "/maps"],
  field: ["/jobs", "/reports", "/documents", "/attendance"],
  finance: ["/invoices", "/payments", "/billing", "/customers"],
  director: ["/analytics", "/jobs", "/invoices", "/payments"],
  sales: ["/requests", "/customers", "/quotations", "/attendance"],
  admin: ["/users", "/audit", "/attendance", "/analytics"],
};

const roleWelcome: Record<Role, string> = {
  operations: "Kendali operasional",
  field: "Tugas lapangan",
  finance: "Finance & billing",
  director: "Ringkasan bisnis",
  sales: "Sales & pelanggan",
  admin: "Administrasi",
};

function subscribePreferences(notify: () => void) {
  window.addEventListener("sgi-home-preferences", notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener("sgi-home-preferences", notify);
    window.removeEventListener("storage", notify);
  };
}

type Preferences = { favorites?: string[]; dismissed?: boolean };

export function MobileHomepage({
  actor,
  role,
}: {
  actor: Actor;
  role: Role;
}) {
  const router = useRouter();
  const featureRef = useRef<HTMLElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const storageKey = `sgi.home.${actor.id}.${role}`;
  const savedString = useSyncExternalStore(
    subscribePreferences,
    () => {
      try {
        return localStorage.getItem(storageKey) ?? "{}";
      } catch {
        return "{}";
      }
    },
    () => "{}",
  );
  let saved: Preferences = {};
  try {
    saved = JSON.parse(savedString) as Preferences;
  } catch {
    // Corrupted device preferences must not prevent the homepage from opening.
  }

  const menus = navigation.filter(
    (item) =>
      item.href !== "/home" &&
      (!item.permission ||
        can({ ...actor, roles: [role] }, item.permission)),
  );
  const menuByHref = (url: string) =>
    menus.find((item) => item.href === url.split(/[?#]/)[0]);
  const actions = quickRoutes[role]
    .map((url) => ({ url, menu: menuByHref(url) }))
    .filter((value) => Boolean(value.menu));
  const available = new Set(menus.map((item) => item.href));
  const favorites = (
    Array.isArray(saved.favorites) ? saved.favorites : defaultFavorites[role]
  )
    .filter((url) => available.has(url))
    .slice(0, 5);

  const [data, setData] = useState<Serialized<WorkspaceData>>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const [activeSlide, setActiveSlide] = useState(0);
  const [dialog, setDialog] = useState<
    "alerts" | "settings" | "favorites" | null
  >(null);
  const [selection, setSelection] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<Serialized<WorkspaceData>>(`data/dashboard?role=${role}`)
      .then((result) => {
        if (result.role !== role)
          throw new Error("Role berubah. Muat ulang homepage.");
        if (alive) {
          setData(result);
          setError("");
        }
      })
      .catch((cause) => {
        if (alive)
          setError(
            cause instanceof Error ? cause.message : "Gagal memuat data.",
          );
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [role, revision]);

  const view = data ? homeSummary(data) : null;
  const slides = view
    ? [...view.summary, ...view.statuses]
        .filter(
          (entry, index, items) =>
            items.findIndex(
              (item) => item.label === entry.label && item.href === entry.href,
            ) === index,
        )
        .slice(0, 5)
    : [];

  function href(target: string) {
    const url = new URL(target, "http://sgi.local");
    url.searchParams.set("role", role);
    return url.pathname + url.search + url.hash;
  }

  function save(patch: Preferences) {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ ...saved, ...patch }));
      window.dispatchEvent(new Event("sgi-home-preferences"));
      return true;
    } catch {
      setError("Preferensi perangkat tidak dapat disimpan.");
      return false;
    }
  }

  function editFavorites() {
    setSelection(favorites);
    setDialog("favorites");
  }

  function updateSlide() {
    const element = carouselRef.current;
    const first = element?.firstElementChild as HTMLElement | null;
    if (!element || !first) return;
    const width = first.getBoundingClientRect().width + 12;
    setActiveSlide(Math.max(0, Math.min(slides.length - 1, Math.round(element.scrollLeft / width))));
  }

  function scrollToSlide(index: number) {
    const element = carouselRef.current;
    const first = element?.firstElementChild as HTMLElement | null;
    const card = element?.children[index] as HTMLElement | undefined;
    if (!element || !card || !first) return;
    element.scrollTo({
      left: card.offsetLeft - first.offsetLeft,
      behavior: "smooth",
    });
    setActiveSlide(index);
  }

  async function logout() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error("Gagal keluar dari akun.");
      window.location.assign("/login");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal keluar.");
    } finally {
      setBusy(false);
    }
  }

  const firstName = actor.name.trim().split(/\s+/)[0] || "rekan";
  return (
    <div className="sgi-mobile-home" data-workspace-role={role}>
      <section className="sgi-mobile-hero" aria-label="Beranda SGI">
        <header className="sgi-mobile-header">
          <div className="sgi-mobile-identity">
            <span className="sgi-mobile-logo">
              <Image
                src="/sgi-logo.png"
                width={26}
                height={26}
                alt=""
                sizes="26px"
              />
            </span>
            <div className="sgi-mobile-welcome">
              <Text as="span">SGI One · {roleLabels[role]}</Text>
              <h1>Halo, {firstName}</h1>
            </div>
          </div>
          <div className="sgi-mobile-header-actions">
            <Button
              variant="ghost"
              shape="circle"
              icon={<BellIcon size={19} />}
              aria-label="Lihat pemberitahuan"
              onClick={() => setDialog("alerts")}
            />
            <Button
              variant="ghost"
              shape="circle"
              icon={<GearSixIcon size={19} />}
              aria-label="Pengaturan akun"
              onClick={() => setDialog("settings")}
            />
          </div>
        </header>

        <SearchTrigger className="sgi-mobile-search" />

        <div className="sgi-mobile-carousel-heading">
          <div>
            <Text as="span">Workspace</Text>
            <h2>{roleWelcome[role]}</h2>
          </div>
          {slides.length > 0 && (
            <span className="sgi-mobile-carousel-count" aria-hidden="true">
              {activeSlide + 1} / {slides.length}
            </span>
          )}
        </div>

        {loading ? (
          <div className="sgi-mobile-carousel-placeholder" role="status">
            Memuat ringkasan…
          </div>
        ) : slides.length > 0 ? (
          <>
            <div
              className="sgi-mobile-carousel"
              ref={carouselRef}
              onScroll={updateSlide}
              role="region"
              aria-label="Kartu ringkasan yang dapat digeser"
              tabIndex={0}
            >
              {slides.map((item, index) => (
                <article className="sgi-mobile-slide" key={item.href + item.label}>
                  <div className="sgi-mobile-slide-top">
                    <span>SGI ONE</span>
                    <span>0{index + 1}</span>
                  </div>
                  <div className="sgi-mobile-slide-content">
                    <span>{item.label}</span>
                    <strong title={item.value}>{item.value}</strong>
                  </div>
                  <Link
                    href={href(item.href)}
                    className="sgi-mobile-slide-link"
                    aria-label={`Lihat ${item.label}: ${item.value}`}
                  >
                    Lihat detail <ArrowRightIcon size={15} />
                  </Link>
                </article>
              ))}
            </div>
            <div className="sgi-mobile-carousel-dots" aria-label="Pilih kartu">
              {slides.map((item, index) => (
                <button
                  key={item.href + item.label}
                  type="button"
                  aria-label={`Kartu ${index + 1}: ${item.label}`}
                  aria-current={activeSlide === index ? "true" : undefined}
                  onClick={() => scrollToSlide(index)}
                >
                  <span />
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="sgi-mobile-carousel-placeholder">
            Ringkasan belum tersedia. Coba muat ulang.
          </div>
        )}
      </section>

      <div className="sgi-mobile-sheet">
        <nav className="sgi-mobile-quick-actions" aria-label="Aksi cepat">
          {actions.map(({ url, menu }) => {
            if (!menu) return null;
            const Icon = menu.icon;
            return (
              <Link
                key={url}
                href={href(url)}
                className="sgi-mobile-quick-action"
                aria-label={menu.label}
              >
                <span className="sgi-mobile-quick-icon">
                  <Icon size={21} weight="regular" />
                </span>
                <span className="sgi-mobile-quick-label">{menu.shortLabel}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sgi-mobile-sheet-content">
          <Feedback error={error} />
          {loading && <LoadingState text="Menyiapkan beranda…" />}
          {view && (
            <>
              {!saved.dismissed && (
                <div className="sgi-mobile-attention">
                  <div className="sgi-mobile-attention-copy">
                    <div className="sgi-mobile-attention-heading">
                      <Badge variant="warning">Perlu perhatian</Badge>
                      <Button
                        variant="ghost"
                        shape="square"
                        size="sm"
                        icon={<XIcon size={15} />}
                        aria-label="Sembunyikan informasi"
                        onClick={() => save({ dismissed: true })}
                      />
                    </div>
                    <p>{view.notice}</p>
                    <Link href={href(view.href)}>
                      {view.action} <CaretRightIcon size={14} />
                    </Link>
                  </div>
                </div>
              )}

              <section className="sgi-mobile-section" aria-labelledby="sgi-mobile-activity-title">
                <div className="sgi-mobile-section-heading">
                  <div>
                    <h2 id="sgi-mobile-activity-title">Aktivitas</h2>
                    <Text as="p" variant="secondary">{view.subtitle}</Text>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    shape="square"
                    icon={<ArrowClockwiseIcon size={17} />}
                    aria-label="Perbarui ringkasan"
                    onClick={() => setRevision((value) => value + 1)}
                    disabled={loading}
                  />
                </div>
                <LayerCard className="sgi-mobile-activity-card">
                  {view.statuses.map((item) => (
                    <Link
                      href={href(item.href)}
                      key={item.label}
                      className="sgi-mobile-activity-row"
                    >
                      <span className="sgi-mobile-activity-title">{item.label}</span>
                      <span className="sgi-mobile-activity-meta">
                        <strong>{item.value}</strong>
                        <CaretRightIcon size={15} />
                      </span>
                    </Link>
                  ))}
                </LayerCard>
              </section>
            </>
          )}

          <section
            className="sgi-mobile-section"
            id="favorit"
            ref={featureRef}
            aria-labelledby="sgi-mobile-favorites-title"
          >
            <div className="sgi-mobile-section-heading">
              <h2 id="sgi-mobile-favorites-title">Favorit</h2>
              <Button
                variant="ghost"
                size="sm"
                icon={<PencilSimpleIcon size={15} />}
                onClick={editFavorites}
              >
                Atur
              </Button>
            </div>
            <div className="sgi-mobile-tools-rail" aria-label="Menu favorit">
              {favorites.length ? (
                favorites
                  .map((url) => menus.find((menu) => menu.href === url))
                  .filter((menu): menu is (typeof menus)[number] => Boolean(menu))
                  .map((menu) => {
                    const Icon = menu.icon;
                    return (
                      <Link
                        href={href(menu.href)}
                        key={menu.href}
                        className="sgi-mobile-tool"
                      >
                        <span className="sgi-mobile-tool-icon">
                          <Icon size={19} weight="regular" />
                        </span>
                        <span>{menu.shortLabel}</span>
                      </Link>
                    );
                  })
              ) : (
                <p>Tambahkan fitur yang sering digunakan lewat tombol Atur.</p>
              )}
            </div>
          </section>

          <section className="sgi-mobile-section sgi-mobile-all" aria-labelledby="sgi-mobile-all-title">
            <div className="sgi-mobile-section-heading">
              <h2 id="sgi-mobile-all-title">Semua fitur</h2>
              <Text as="span" variant="secondary">
                {menus.length} menu
              </Text>
            </div>
            <div className="sgi-mobile-feature-list">
              {menus.map((menu) => {
                const Icon = menu.icon;
                return (
                  <Link href={href(menu.href)} key={menu.href} className="sgi-mobile-feature">
                    <Icon size={18} weight="regular" />
                    <span>{menu.label}</span>
                    <CaretRightIcon size={14} className="sgi-mobile-feature-arrow" />
                  </Link>
                );
              })}
            </div>
          </section>
          <p className="sgi-mobile-footer-note">
            SGI One · Data simulasi untuk demonstrasi
          </p>
        </div>
      </div>

      <Modal
        open={dialog === "alerts"}
        onClose={() => setDialog(null)}
        title="Perlu perhatian"
        description="Informasi terbaru dari workspace Anda."
      >
        {view ? (
          <>
            <Text>{view.notice}</Text>
            <LinkButton variant="primary" href={href(view.href)}>
              {view.action}
            </LinkButton>
          </>
        ) : (
          <Text>Belum ada ringkasan. Coba perbarui halaman.</Text>
        )}
      </Modal>

      <Modal
        open={dialog === "settings"}
        onClose={() => setDialog(null)}
        title="Akun dan pengaturan"
        description="Pilih role kerja dan sesuaikan beranda."
      >
        <Text as="h2">{actor.name}</Text>
        <Text variant="secondary">{actor.email}</Text>
        {actor.roles.length > 1 && (
          <Select<Role>
            label="Role aktif"
            value={role}
            items={Object.fromEntries(actor.roles.map((item) => [item, roleLabels[item]]))}
            onValueChange={(next) => {
              if (next) router.push(`/home?role=${next}`);
            }}
          />
        )}
        <Button variant="outline" onClick={editFavorites}>
          Atur favorit
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            if (save({ dismissed: false })) setDialog(null);
          }}
        >
          Tampilkan informasi perhatian
        </Button>
        <Button
          variant="primary"
          icon={<SignOutIcon size={18} />}
          loading={busy}
          onClick={logout}
        >
          Keluar
        </Button>
      </Modal>

      <Modal
        open={dialog === "favorites"}
        onClose={() => setDialog(null)}
        title="Atur menu favorit"
        description="Pilih maksimal lima fitur untuk akses cepat."
      >
        <div className="sgi-mobile-favorite-options">
          {menus.map((menu) => (
            <Checkbox
              key={menu.href}
              label={menu.label}
              checked={selection.includes(menu.href)}
              disabled={selection.length >= 5 && !selection.includes(menu.href)}
              onCheckedChange={(checked) =>
                setSelection((current) =>
                  checked
                    ? [...current, menu.href]
                    : current.filter((url) => url !== menu.href),
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
