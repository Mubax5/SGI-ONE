"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Button,
  Breadcrumbs,
  Dialog,
  LinkButton,
  Text,
  DropdownMenu,
  LinkProvider,
  Sidebar,
  Tabs,
  useSidebar,
  type LinkComponentProps,
} from "@cloudflare/kumo";
import {
  SquaresFourIcon,
  XIcon,
  SignOutIcon,
  HouseIcon,
  BookmarkSimpleIcon,
  MagnifyingGlassIcon,
  CaretDownIcon,
  UserCircleIcon,
  ClockIcon,
  CameraIcon,
  ChartBarIcon,
  ReceiptIcon,
  PackageIcon,
  UsersIcon,
} from "@phosphor-icons/react";
import {
  createContext,
  forwardRef,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { Actor, can, Role, roleLabels } from "@/lib/domain";
import { navigation as nav, navigationGroups } from "./navigation";
import { Feedback } from "./shared";
import { workspaceActions, workspaceRole } from "@/lib/workspace";
import { GlobalSearch, SearchProvider, SearchTrigger } from "./global-search";
const RoleContext = createContext<{ role: Role; defaultRole: Role } | null>(
  null,
);
const AppLink = forwardRef<HTMLAnchorElement, LinkComponentProps>(
  function AppLink({ href, to, ...props }, ref) {
    const workspace = useContext(RoleContext);
    let target = href ?? to ?? "/";
    if (
      workspace &&
      workspace.role !== workspace.defaultRole &&
      target.startsWith("/") &&
      !target.startsWith("/api/")
    ) {
      const url = new URL(target, "http://sgi.local");
      if (!url.searchParams.has("role"))
        url.searchParams.set("role", workspace.role);
      target = url.pathname + url.search + url.hash;
    }
    return <Link ref={ref} href={target} {...props} />;
  },
);
export function Shell({
  actor,
  children,
}: {
  actor: Actor;
  children: ReactNode;
}) {
  return (
    <LinkProvider component={AppLink}>
      <Link href="#main-content" className="skip-link">
        Langsung ke isi halaman
      </Link>
      <Sidebar.Provider
        defaultOpen
        mobileBreakpoint={639}
        className="app-shell"
      >
        <ShellContent actor={actor}>{children}</ShellContent>
      </Sidebar.Provider>
    </LinkProvider>
  );
}
function ShellContent({
  actor,
  children,
}: {
  actor: Actor;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("role");
  const defaultRole = workspaceRole(actor);
  const role =
    requested && actor.roles.includes(requested as Role)
      ? (requested as Role)
      : defaultRole;
  const MainIcon = {
    director: ChartBarIcon,
    operations: CameraIcon,
    field: CameraIcon,
    finance: ReceiptIcon,
    sales: PackageIcon,
    admin: UsersIcon,
  }[role];
  const mainAction = workspaceActions[role];
  const { state, setOpenMobile, isMobile } = useSidebar();
  const isLanding = pathname === "/home" || pathname === "/dashboard";
  const isHome = isLanding && isMobile;
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const accessible = nav.filter(
    (n) => !n.permission || can(actor, n.permission),
  );
  const current = accessible.find(
    (n) =>
      (isLanding && n.href === "/home") ||
      pathname === n.href ||
      pathname.startsWith(`${n.href}/`),
  );
  const sectionLinks = accessible.filter((n) =>
    isLanding
      ? ["/home", "/jobs", "/documents", "/invoices"].includes(n.href)
      : current?.href === "/analytics"
        ? ["/home", "/analytics"].includes(n.href)
        : n.group === current?.group,
  );
  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((previous) => !previous);
      }
    }
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);
  async function logout() {
    setBusy(true);
    try {
      const result = await fetch("/api/auth/sign-out", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!result.ok) throw new Error("Logout gagal. Coba kembali.");
      window.location.assign("/login");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Logout gagal.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <RoleContext.Provider value={{ role, defaultRole }}>
      <SearchProvider open={() => setSearchOpen(true)}>
        <>
          {!isMobile && !isHome && (
            <Sidebar
              className="sgi-sidebar"
              contentClassName="sgi-sidebar-surface"
              aria-label="Navigasi SGI"
            >
              <Sidebar.Header>
                <Link
                  href={role === defaultRole ? "/home" : "/home?role=" + role}
                  className="sidebar-brand"
                  onClick={() => setOpenMobile(false)}
                  aria-label="SGI One · Sandika Global Indonesia"
                >
                  <Image
                    src="/sgi-logo.png"
                    width={943}
                    height={784}
                    sizes="32px"
                    alt="SGI"
                    className="sidebar-brand-logo"
                  />
                  <span className="sidebar-brand-context">
                    SGI One<span>Sandika Global Indonesia</span>
                  </span>
                </Link>
                <Sidebar.Close
                  className="mobile-close"
                  aria-label="Tutup navigasi"
                />
              </Sidebar.Header>
              <Sidebar.Content>
                <Button
                  variant="outline"
                  className="sidebar-search"
                  icon={<MagnifyingGlassIcon size={16} />}
                  aria-label="Pencarian cepat"
                  onClick={() => setSearchOpen(true)}
                >
                  <span>Cari fitur dan data…</span>
                  <kbd>Ctrl K</kbd>
                </Button>
                <nav aria-label="Navigasi utama">
                  {accessible.some((n) => n.href === "/home") && (
                    <Sidebar.Menu>
                      <Sidebar.MenuButton
                        href="/home"
                        icon={HouseIcon}
                        active={isLanding}
                        onClick={() => setOpenMobile(false)}
                      >
                        Dashboard
                      </Sidebar.MenuButton>
                    </Sidebar.Menu>
                  )}
                  <Sidebar.Group>
                    <Sidebar.GroupLabel>Workspace</Sidebar.GroupLabel>
                    <Sidebar.Menu>
                      {navigationGroups.map(({ label, icon: Icon }) => {
                        const rows = accessible.filter(
                          (n) => n.group === label && n.href !== "/home",
                        );
                        return rows.length ? (
                          <Sidebar.MenuItem key={label}>
                            <Sidebar.Collapsible defaultOpen>
                              <Sidebar.CollapsibleTrigger
                                render={
                                  <Sidebar.MenuButton
                                    icon={Icon}
                                    tooltip={label}
                                  >
                                    {label}
                                    <Sidebar.MenuChevron />
                                  </Sidebar.MenuButton>
                                }
                              />
                              <Sidebar.CollapsibleContent>
                                <Sidebar.MenuSub>
                                  {rows.map(
                                    ({
                                      href,
                                      label: itemLabel,
                                      icon: MenuIcon,
                                    }) => (
                                      <Sidebar.MenuSubButton
                                        key={href}
                                        href={href}
                                        active={
                                          pathname === href ||
                                          pathname.startsWith(`${href}/`)
                                        }
                                        onClick={() => setOpenMobile(false)}
                                      >
                                        <MenuIcon size={16} />
                                        <span>{itemLabel}</span>
                                      </Sidebar.MenuSubButton>
                                    ),
                                  )}
                                </Sidebar.MenuSub>
                              </Sidebar.CollapsibleContent>
                            </Sidebar.Collapsible>
                          </Sidebar.MenuItem>
                        ) : null;
                      })}
                    </Sidebar.Menu>
                  </Sidebar.Group>
                </nav>
              </Sidebar.Content>
              <Sidebar.Footer>
                <Sidebar.Trigger
                  aria-label={
                    state === "collapsed"
                      ? "Perluas sidebar"
                      : "Ringkas sidebar"
                  }
                />
                <span className="sidebar-environment">
                  <span className="environment-dot" />
                  Lokal · data simulasi
                </span>
              </Sidebar.Footer>
            </Sidebar>
          )}
          <div className={`main-area ${isHome ? "homepage-main" : ""}`}>
            {!isHome && (
              <header className="topbar">
                <div className="topbar-location">
                  <LinkButton
                    href="/home"
                    className="mobile-menu"
                    aria-label="Kembali ke homepage"
                    shape="square"
                    variant="ghost"
                    icon={<HouseIcon size={22} />}
                  />
                  <Breadcrumbs>
                    {current && pathname !== current.href ? (
                      <>
                        <Breadcrumbs.Link
                          href={current.href}
                          icon={<current.icon size={16} />}
                        >
                          {current.label}
                        </Breadcrumbs.Link>
                        <Breadcrumbs.Separator />
                        <Breadcrumbs.Current>Detail</Breadcrumbs.Current>
                      </>
                    ) : (
                      <Breadcrumbs.Current
                        icon={current && <current.icon size={16} />}
                      >
                        {isLanding
                          ? "Dashboard"
                          : (current?.label ?? "SGI One")}
                      </Breadcrumbs.Current>
                    )}
                  </Breadcrumbs>
                </div>
                <SearchTrigger className="header-search" />
                <div className="topbar-user">
                  <DropdownMenu>
                    <DropdownMenu.Trigger
                      render={
                        <Button
                          variant="ghost"
                          aria-label="Menu akun"
                          className="account-trigger"
                          icon={<UserCircleIcon size={20} />}
                        >
                          <span>{actor.name}</span>
                          <CaretDownIcon size={12} />
                        </Button>
                      }
                    />
                    <DropdownMenu.Content>
                      <DropdownMenu.Label>{actor.name}</DropdownMenu.Label>
                      <div className="account-details">
                        <p>{actor.email}</p>
                        <p>
                          {actor.roles.map((r) => roleLabels[r]).join(" · ")}
                        </p>
                      </div>
                      <DropdownMenu.Separator />
                      <DropdownMenu.LinkItem
                        href="/attendance"
                        icon={ClockIcon}
                      >
                        Absensi saya
                      </DropdownMenu.LinkItem>
                      <DropdownMenu.Item
                        icon={SignOutIcon}
                        onClick={logout}
                        disabled={busy}
                      >
                        Keluar
                      </DropdownMenu.Item>
                    </DropdownMenu.Content>
                  </DropdownMenu>
                  <Button
                    aria-label="Keluar"
                    variant="ghost"
                    shape="square"
                    icon={<SignOutIcon size={18} />}
                    loading={busy}
                    onClick={logout}
                  />
                </div>
              </header>
            )}
            {!isHome && sectionLinks.length > 1 && (
              <nav
                className="module-navigation"
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
                        {item.href === "/home" ? "Dashboard" : item.label}
                      </span>
                    ),
                    render: (
                      <Link
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
            <main
              id="main-content"
              tabIndex={-1}
              className={`page-content ${isHome ? "homepage-content" : ""}`}
            >
              {children}
            </main>
            {!isHome && (
              <footer className="app-footer">
                <span>SGI One · Operations & business management</span>
                <span>Data demo adalah simulasi</span>
              </footer>
            )}
          </div>
          <nav className="mobile-bottom-nav" aria-label="Navigasi bawah">
            <LinkButton
              href="/home"
              variant="ghost"
              aria-current={pathname === "/home" ? "page" : undefined}
              icon={<HouseIcon size={22} />}
            >
              Home
            </LinkButton>
            <LinkButton
              href="/home#favorit"
              variant="ghost"
              icon={<BookmarkSimpleIcon size={22} />}
            >
              Favorit
            </LinkButton>
            <div className="mobile-main-action">
              <LinkButton
                href={mainAction.href}
                variant="primary"
                shape="circle"
                className="mobile-main-button"
                icon={<MainIcon size={28} />}
                aria-label={mainAction.label}
                onClick={(event) => {
                  const target = new URL(mainAction.href, "http://sgi.local");
                  if (
                    target.searchParams.get("create") === "1" &&
                    pathname === target.pathname &&
                    params.get("create") === "1"
                  ) {
                    event.preventDefault();
                    target.searchParams.set("role", role);
                    target.searchParams.set("open", String(Date.now()));
                    router.push(target.pathname + target.search);
                  }
                }}
              />
              <span>{mainAction.label}</span>
            </div>
            <LinkButton
              href="/analytics"
              variant="ghost"
              aria-current={pathname === "/analytics" ? "page" : undefined}
              icon={<ChartBarIcon size={22} />}
            >
              Analitik
            </LinkButton>
            <Button
              variant="ghost"
              icon={<SquaresFourIcon size={22} />}
              onClick={() => setMenuOpen(true)}
            >
              Menu
            </Button>
          </nav>
          <Dialog.Root open={menuOpen} onOpenChange={setMenuOpen}>
            <Dialog size="lg" className="modal">
              <div className="modal-header">
                <div>
                  <Dialog.Title>Semua menu</Dialog.Title>
                  <Dialog.Description>Workspace SGI One</Dialog.Description>
                </div>
                <Button
                  shape="square"
                  variant="ghost"
                  icon={<XIcon size={18} />}
                  aria-label="Tutup menu"
                  onClick={() => setMenuOpen(false)}
                />
              </div>
              <div className="mobile-menu-grid">
                {accessible.map(({ href, label, icon: Icon }) => (
                  <LinkButton
                    key={href}
                    href={href}
                    icon={<Icon size={24} />}
                    variant="outline"
                    aria-current={pathname === href ? "page" : undefined}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Text as="span">{label}</Text>
                  </LinkButton>
                ))}
              </div>
            </Dialog>
          </Dialog.Root>
          <GlobalSearch
            actor={actor}
            role={role}
            open={searchOpen}
            onOpenChange={setSearchOpen}
          />
        </>
      </SearchProvider>
    </RoleContext.Provider>
  );
}
