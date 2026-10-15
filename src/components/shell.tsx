"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Badge,
  Breadcrumbs,
  Button,
  DropdownMenu,
  Input,
  LinkButton,
  LinkProvider,
  Sidebar,
  Tabs,
  Text,
  useSidebar,
  type LinkComponentProps,
} from "@cloudflare/kumo";
import {
  ArrowLeftIcon,
  CameraIcon,
  ChartBarIcon,
  ClockIcon,
  HouseIcon,
  MagnifyingGlassIcon,
  PackageIcon,
  ReceiptIcon,
  ShieldCheckIcon,
  SignOutIcon,
  SquaresFourIcon,
  UserCircleIcon,
} from "@phosphor-icons/react";
import { forwardRef, ReactNode, useEffect, useState } from "react";
import { Actor, Role, can, roleLabels } from "@/lib/domain";
import { WorkspaceLink } from "./workspace-link";
import {
  analyticsRoles,
  workspaceActions,
  workspaceDescriptions,
} from "@/lib/workspace";
import { useChangeMonitor } from "@/lib/live-data";
import { navigationGroups, workspaceNavigation } from "./navigation";
import { api, Feedback, Modal } from "./shared";
import { GlobalSearch } from "./global-search";
import { usePhoneLayout } from "@/lib/phone-layout";
import { cleanWorkspaceHref } from "@/lib/workspace-url";

const AppLink = forwardRef<HTMLAnchorElement, LinkComponentProps>(
  function AppLink({ href, to, ...props }, ref) {
    return <WorkspaceLink ref={ref} href={href ?? to ?? "/home"} {...props} />;
  },
);
export function Shell({
  actor,
  initialRole,
  children,
}: {
  actor: Actor;
  initialRole: Role;
  children: ReactNode;
}) {
  return (
    <Sidebar.Provider defaultOpen mobileBreakpoint={640} className="app-shell">
      <ShellContent actor={actor} initialRole={initialRole}>
        {children}
      </ShellContent>
    </Sidebar.Provider>
  );
}
function ShellContent({
  actor,
  initialRole,
  children,
}: {
  actor: Actor;
  initialRole: Role;
  children: ReactNode;
}) {
  const pathname = usePathname(),
    params = useSearchParams(),
    router = useRouter();
  const role = initialRole;
  const isMobile = usePhoneLayout();
  const canChooseWorkspace = can(actor, "users");
  const hasAttendance = can({ ...actor, roles: [role] }, "attendanceSelf");
  const { state, setOpenMobile } = useSidebar();
  const isLanding = ["/home", "/dashboard"].includes(pathname);
  const accessible = workspaceNavigation(actor, role);
  const current = accessible.find(
    (item) =>
      (isLanding && item.href === "/home") ||
      pathname === item.href ||
      pathname.startsWith(`${item.href}/`),
  );
  const moduleTitle = isLanding
    ? "Dashboard"
    : role === "field" && current?.href === "/jobs"
      ? "Tugas"
      : (current?.label ?? "SGI One");
  const isDetail = Boolean(current && pathname !== current.href && !isLanding);
  const sectionLinks = accessible.filter(
    (item) => item.group === current?.group && item.href !== "/home",
  );
  const groupLanding =
    current &&
    accessible.find(
      (item) =>
        item.href ===
        (
          {
            Administrasi: "/system",
            Keuangan: "/billing",
            Operasional: role === "sales" ? "/customers" : "/jobs",
            Pemantauan: "/analytics",
          } as Record<string, string>
        )[current.group],
    );
  const jobParent = pathname.includes("/delivery/")
    ? pathname.split("/delivery/")[0]
    : undefined;
  const [dialog, setDialog] = useState<"menu" | "workspace" | "account" | null>(
    null,
  );
  const [menuSearch, setMenuSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [recordTitle, setRecordTitle] = useState<{
    path: string;
    title: string;
  }>();
  const pageTitle = isDetail
    ? pathname.includes("/print")
      ? "Cetak invoice"
      : pathname.includes("/delivery/")
        ? "Surat jalan"
        : "Detail job"
    : moduleTitle;
  const detailLabel =
    recordTitle?.path === pathname && !pathname.includes("/delivery/")
      ? recordTitle.title
      : pageTitle;
  useChangeMonitor();
  const menuItems = accessible.filter((item) =>
    `${item.label} ${item.group}`
      .toLocaleLowerCase("id")
      .includes(menuSearch.toLocaleLowerCase("id")),
  );
  const mainAction = workspaceActions[role];
  const MainIcon = {
    admin: ShieldCheckIcon,
    field: CameraIcon,
    operations: CameraIcon,
    finance: ReceiptIcon,
    sales: PackageIcon,
    director: ChartBarIcon,
  }[role];
  const fourth = analyticsRoles.includes(role)
    ? { href: "/analytics", label: "Analitik", icon: ChartBarIcon }
    : role === "admin"
      ? { href: "/audit", label: "Audit", icon: ShieldCheckIcon }
      : { href: "/jobs", label: "Tugas", icon: PackageIcon };
  const href = cleanWorkspaceHref;
  useEffect(() => {
    const channel = new BroadcastChannel("sgi.workspace");
    channel.onmessage = (event) => {
      if (event.data?.owner === actor.id) router.refresh();
    };
    const syncPreference = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/me", { cache: "no-store" });
        if (response.ok) {
          const account = await response.json();
          if (account.actor.id !== actor.id || account.workspace !== role)
            router.refresh();
        }
      } catch {
        /* A network failure must not replace the current page. */
      }
    };
    window.addEventListener("focus", syncPreference);
    document.addEventListener("visibilitychange", syncPreference);
    return () => {
      channel.close();
      window.removeEventListener("focus", syncPreference);
      document.removeEventListener("visibilitychange", syncPreference);
    };
  }, [actor.id, role, router]);
  useEffect(() => {
    const key = `sgi.route.${actor.id}.${role}`,
      location = pathname + (params.size ? `?${params}` : "");
    const last = sessionStorage.getItem(key);
    if (last && last !== location)
      sessionStorage.setItem(key + ".previous", last);
    sessionStorage.setItem(key, location);
  }, [actor.id, role, pathname, params]);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((value) => !value);
      }
    };
    const showWorkspaces = () => {
      if (canChooseWorkspace) setDialog("workspace");
    };
    window.addEventListener("sgi-open-workspace", showWorkspaces);
    const breadcrumb = (event: Event) =>
      setRecordTitle(
        (event as CustomEvent<{ path: string; title: string }>).detail,
      );
    document.addEventListener("keydown", shortcut);
    window.addEventListener("sgi-breadcrumb", breadcrumb);
    return () => {
      window.removeEventListener("sgi-open-workspace", showWorkspaces);
      document.removeEventListener("keydown", shortcut);
      window.removeEventListener("sgi-breadcrumb", breadcrumb);
    };
  }, [canChooseWorkspace]);
  async function chooseWorkspace(next: Role) {
    if (!canChooseWorkspace) return;
    setBusy(true);
    setError("");
    try {
      await api("workspace", { role: next });
      const channel = new BroadcastChannel("sgi.workspace");
      channel.postMessage({ owner: actor.id });
      channel.close();
      const allowed = workspaceNavigation(actor, next).some(
        (item) =>
          pathname === item.href || pathname.startsWith(`${item.href}/`),
      );
      router.push(
        href(allowed ? pathname + (params.size ? `?${params}` : "") : "/home"),
      );
      router.refresh();
      setDialog(null);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Area kerja belum dapat diganti. Coba lagi.",
      );
    } finally {
      setBusy(false);
    }
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
      setBusy(false);
    }
  }
  function back() {
    const previous = sessionStorage.getItem(
      `sgi.route.${actor.id}.${role}.previous`,
    );
    router.push(
      previous?.startsWith("/") && previous.split("?")[0] !== pathname
        ? previous
        : href(
            pathname !== current?.href ? (current?.href ?? "/home") : "/home",
          ),
    );
  }
  return (
    <LinkProvider component={AppLink}>
      <Link href="#main-content" className="skip-link">
        Langsung ke isi halaman
      </Link>
      {!isMobile && (
        <Sidebar
          className="sgi-sidebar"
          contentClassName="sgi-sidebar-surface"
          aria-label="Navigasi SGI"
        >
          <Sidebar.Header>
            <Link
              href={href("/home")}
              className="sidebar-brand"
              aria-label="SGI One · Sandika Global Indonesia"
            >
              <Image src="/sgi-logo.png" width={32} height={27} alt="SGI" />
              <span className="sidebar-brand-context">
                SGI One<span>Sandika Global Indonesia</span>
              </span>
            </Link>
          </Sidebar.Header>
          <Sidebar.Content>
            <Button
              variant="outline"
              className="sidebar-search"
              icon={<MagnifyingGlassIcon size={16} />}
              onClick={() => setSearchOpen(true)}
              aria-label="Pencarian cepat"
            >
              Cari fitur dan data…<kbd>Ctrl K</kbd>
            </Button>
            <Sidebar.Menu>
              <Sidebar.MenuButton
                href="/home"
                icon={HouseIcon}
                active={isLanding}
              >
                Dashboard
              </Sidebar.MenuButton>
            </Sidebar.Menu>
            {navigationGroups.map(({ label, icon: Icon }) => {
              const rows = accessible.filter(
                (item) => item.group === label && item.href !== "/home",
              );
              return rows.length ? (
                <Sidebar.Group key={label}>
                  <Sidebar.Menu>
                    <Sidebar.MenuItem>
                      <Sidebar.Collapsible defaultOpen>
                        <Sidebar.CollapsibleTrigger
                          render={
                            <Sidebar.MenuButton icon={Icon} tooltip={label}>
                              {label}
                              <Sidebar.MenuChevron />
                            </Sidebar.MenuButton>
                          }
                        />
                        <Sidebar.CollapsibleContent>
                          <Sidebar.MenuSub>
                            {rows.map((item) => (
                              <Sidebar.MenuSubButton
                                key={item.href}
                                href={item.href}
                                active={
                                  pathname === item.href ||
                                  pathname.startsWith(`${item.href}/`)
                                }
                                onClick={() => setOpenMobile(false)}
                              >
                                <item.icon size={16} />
                                {item.label}
                              </Sidebar.MenuSubButton>
                            ))}
                          </Sidebar.MenuSub>
                        </Sidebar.CollapsibleContent>
                      </Sidebar.Collapsible>
                    </Sidebar.MenuItem>
                  </Sidebar.Menu>
                </Sidebar.Group>
              ) : null;
            })}
          </Sidebar.Content>
          <Sidebar.Footer>
            <Sidebar.Trigger
              aria-label={
                state === "collapsed" ? "Perluas sidebar" : "Ringkas sidebar"
              }
            />
          </Sidebar.Footer>
        </Sidebar>
      )}
      <div className="main-area" data-active-workspace={role}>
        <header className="topbar">
          <div className="topbar-location">
            {!isLanding && (
              <Button
                className="mobile-back"
                shape="square"
                variant="ghost"
                icon={<ArrowLeftIcon size={20} />}
                aria-label="Kembali ke halaman sebelumnya"
                onClick={back}
              />
            )}
            <Text
              as="h1"
              title={pageTitle}
              aria-label={pageTitle}
              DANGEROUS_className="shell-page-title"
            >
              {isMobile && !isDetail && !isLanding
                ? (
                    {
                      "/quotations": "Penawaran",
                      "/requests": "Permintaan",
                      "/reports": "Laporan",
                      "/documents": "Dokumen",
                      "/system": "Sistem",
                      "/users": "Pengguna",
                    } as Record<string, string>
                  )[pathname] || pageTitle
                : pageTitle}
            </Text>
          </div>
          <div className="topbar-user">
            <Button
              className="mobile-search"
              shape="square"
              variant="ghost"
              icon={<MagnifyingGlassIcon size={20} />}
              aria-label="Buka pencarian global"
              onClick={() => setSearchOpen(true)}
            />
            {isMobile ? (
              <Button
                shape="square"
                variant="ghost"
                icon={<UserCircleIcon size={20} />}
                aria-label="Menu akun"
                onClick={() => setDialog("account")}
              />
            ) : (
              <DropdownMenu>
                <DropdownMenu.Trigger
                  render={
                    <Button
                      variant="ghost"
                      className="account-trigger"
                      icon={<UserCircleIcon size={20} />}
                      aria-label="Menu akun"
                    >
                      <span>{actor.name}</span>
                    </Button>
                  }
                />
                <DropdownMenu.Content className="account-menu">
                  <DropdownMenu.Group>
                    <DropdownMenu.Label>{actor.name}</DropdownMenu.Label>
                    <div className="account-details">
                      {actor.email}
                      <p>{roleLabels[role]}</p>
                    </div>
                  </DropdownMenu.Group>
                  <DropdownMenu.Separator />
                  {canChooseWorkspace && (
                    <DropdownMenu.Item
                      icon={SquaresFourIcon}
                      onClick={() => setDialog("workspace")}
                    >
                      Pilih area kerja
                    </DropdownMenu.Item>
                  )}
                  {hasAttendance && (
                    <DropdownMenu.LinkItem
                      href={href("/attendance")}
                      icon={ClockIcon}
                    >
                      Absensi saya
                    </DropdownMenu.LinkItem>
                  )}
                  <DropdownMenu.Item
                    icon={SignOutIcon}
                    onClick={logout}
                    disabled={busy}
                  >
                    Keluar
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu>
            )}
          </div>
        </header>
        {current && (isDetail || !isMobile) && (
          <nav className="page-breadcrumbs" aria-label="Alur halaman">
            <Breadcrumbs>
              {isDetail ? (
                <>
                  <Breadcrumbs.Link href={href(current.href)}>
                    {moduleTitle}
                  </Breadcrumbs.Link>
                  <Breadcrumbs.Separator />
                  {jobParent && (
                    <>
                      <Breadcrumbs.Link href={href(jobParent)}>
                        Detail job
                      </Breadcrumbs.Link>
                      <Breadcrumbs.Separator />
                    </>
                  )}
                  <Breadcrumbs.Current>{detailLabel}</Breadcrumbs.Current>
                </>
              ) : (
                <>
                  {!isLanding &&
                    groupLanding &&
                    groupLanding.href !== current.href && (
                      <>
                        <Breadcrumbs.Link href={href(groupLanding.href)}>
                          {current.group}
                        </Breadcrumbs.Link>
                        <Breadcrumbs.Separator />
                      </>
                    )}
                  <Breadcrumbs.Current>{moduleTitle}</Breadcrumbs.Current>
                </>
              )}
            </Breadcrumbs>
          </nav>
        )}
        {!isLanding && sectionLinks.length > 1 && (
          <nav
            className="module-navigation enterprise-module-navigation"
            aria-label="Halaman dalam bagian"
          >
            <Tabs
              className="module-navigation-tabs"
              value={current?.href}
              tabs={sectionLinks.map((item) => ({
                value: item.href,
                label: (
                  <span className="nav-tab-label">
                    <item.icon size={16} />
                    {item.label}
                  </span>
                ),
                render: (
                  <WorkspaceLink
                    href={item.href}
                    aria-current={
                      current?.href === item.href ? "page" : undefined
                    }
                  />
                ),
                nativeButton: false,
              }))}
            />
          </nav>
        )}
        <Feedback error={error} />
        <main id="main-content" tabIndex={-1} className="page-content">
          {children}
        </main>
        <footer className="app-footer">
          <span>SGI One · Sandika Global Indonesia</span>
        </footer>
      </div>
      <nav
        className="mobile-bottom-nav raised-mobile-nav ring ring-kumo-line shadow-md"
        aria-label="Navigasi bawah"
      >
        <LinkButton
          href="/home"
          variant="ghost"
          aria-current={isLanding ? "page" : undefined}
        >
          <span className="mobile-nav-content">
            <HouseIcon size={21} weight={isLanding ? "fill" : "regular"} />
            <span className="mobile-nav-label">Home</span>
          </span>
        </LinkButton>
        <Button variant="ghost" onClick={() => setSearchOpen(true)}>
          <span className="mobile-nav-content">
            <MagnifyingGlassIcon size={21} />
            <span className="mobile-nav-label">Cari</span>
          </span>
        </Button>
        <div className="mobile-main-action">
          <LinkButton
            href={mainAction.href}
            variant="primary"
            shape="circle"
            className="mobile-main-button"
            aria-label={mainAction.label}
            onClick={(e) => {
              const url = new URL(mainAction.href, "http://sgi.local");
              if (
                url.searchParams.get("create") === "1" &&
                pathname === url.pathname &&
                params.get("create") === "1"
              ) {
                e.preventDefault();
                url.searchParams.set("open", String(Date.now()));
                router.push(href(url.pathname + url.search));
              }
            }}
            icon={<MainIcon size={28} />}
          />
          <span
            className="mobile-nav-label mobile-main-label"
            aria-hidden="true"
          >
            {mainAction.label}
          </span>
        </div>
        <LinkButton
          href={fourth.href}
          variant="ghost"
          aria-current={pathname === fourth.href ? "page" : undefined}
        >
          <span className="mobile-nav-content">
            <fourth.icon size={21} />
            <span className="mobile-nav-label">{fourth.label}</span>
          </span>
        </LinkButton>
        <Button
          variant="ghost"
          onClick={() => {
            setMenuSearch("");
            setDialog("menu");
          }}
        >
          <span className="mobile-nav-content">
            <SquaresFourIcon size={21} />
            <span className="mobile-nav-label">Menu</span>
          </span>
        </Button>
      </nav>
      <Modal
        open={canChooseWorkspace && dialog === "workspace"}
        onClose={() => setDialog(null)}
        title="Pilih area kerja"
      >
        <div className="workspace-options detail-body">
          {actor.roles.map((next) => (
            <Button
              key={next}
              variant={next === role ? "secondary" : "ghost"}
              className="workspace-option"
              onClick={() => void chooseWorkspace(next)}
              disabled={busy}
            >
              <span className="workspace-option-copy">
                <Text as="strong">{roleLabels[next]}</Text>
                <Text as="span" variant="secondary">
                  {workspaceDescriptions[next]}
                </Text>
              </span>
              {next === role && <Badge variant="secondary">Aktif</Badge>}
            </Button>
          ))}
        </div>
      </Modal>
      <Modal
        open={dialog === "menu"}
        onClose={() => setDialog(null)}
        title="Semua menu"
      >
        <div className="menu-sheet-body">
          <Input
            aria-label="Cari menu"
            placeholder="Cari menu…"
            value={menuSearch}
            onChange={(e) => setMenuSearch(e.target.value)}
          />
          <nav className="mobile-menu-grid" aria-label="Semua menu">
            {menuItems.map((item) => (
              <LinkButton
                key={item.href}
                href={item.href}
                variant="ghost"
                icon={<item.icon size={20} />}
                onClick={() => setDialog(null)}
              >
                {item.label}
              </LinkButton>
            ))}
            {!menuItems.length && (
              <Text variant="secondary">
                Menu tidak ditemukan. Coba kata lain.
              </Text>
            )}
          </nav>
        </div>
      </Modal>
      <Modal
        open={dialog === "account"}
        onClose={() => setDialog(null)}
        title="Akun saya"
      >
        <div className="account-profile">
          <div className="account-identity">
            <span className="account-avatar" aria-hidden="true">
              <UserCircleIcon size={32} />
            </span>
            <div>
              <Text as="strong">{actor.name}</Text>
              <Text variant="secondary">{actor.email}</Text>
            </div>
          </div>
          <div className="account-workspace">
            <Text variant="secondary">Area kerja aktif</Text>
            <Badge variant="secondary">{roleLabels[role]}</Badge>
          </div>
          <div className="account-menu-list">
            {canChooseWorkspace && (
              <Button
                variant="ghost"
                className="account-menu-row"
                icon={<SquaresFourIcon size={18} />}
                onClick={() => setDialog("workspace")}
              >
                Pilih area kerja
              </Button>
            )}
            {hasAttendance && (
              <LinkButton
                href={href("/attendance")}
                className="account-menu-row"
                variant="ghost"
                icon={<ClockIcon size={18} />}
                onClick={() => setDialog(null)}
              >
                Absensi saya
              </LinkButton>
            )}
            <Button
              variant="ghost"
              className="account-menu-row account-signout"
              icon={<SignOutIcon size={18} />}
              onClick={logout}
              loading={busy}
            >
              Keluar
            </Button>
          </div>
        </div>
      </Modal>
      <GlobalSearch
        actor={{ ...actor, roles: [role] }}
        role={role}
        open={searchOpen}
        onOpenChange={setSearchOpen}
      />
    </LinkProvider>
  );
}
