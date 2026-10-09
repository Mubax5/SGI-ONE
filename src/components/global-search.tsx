"use client";
import { Banner, Button, CommandPalette, Text } from "@cloudflare/kumo";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { Actor, can } from "@/lib/domain";
import { navigation } from "./navigation";
import type { SearchResult } from "@/modules/search";
const SearchContext = createContext<(() => void) | null>(null);
export function SearchProvider({
  children,
  open,
}: {
  children: ReactNode;
  open: () => void;
}) {
  return (
    <SearchContext.Provider value={open}>{children}</SearchContext.Provider>
  );
}
export function SearchTrigger({ className = "" }: { className?: string }) {
  const open = useContext(SearchContext);
  return (
    <Button
      variant="outline"
      className={`global-search-trigger ${className}`}
      icon={<MagnifyingGlassIcon size={18} />}
      aria-label="Buka pencarian global"
      onClick={() => open?.()}
    >
      <span>Cari fitur, job, customer…</span>
      <kbd>Ctrl K</kbd>
    </Button>
  );
}
type SearchItem = SearchResult & { icon: typeof MagnifyingGlassIcon };
type SearchGroup = { label: string; items: SearchItem[] };
export function GlobalSearch({
  actor,
  open,
  onOpenChange,
  role,
}: {
  actor: Actor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState<{
    query: string;
    results: SearchResult[];
    error?: string;
  }>();
  const value = query.trim();
  useEffect(() => {
    if (!open || value.length < 2) return;
    const abort = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const result = await fetch(
          `/api/search?q=${encodeURIComponent(value)}`,
          { signal: abort.signal, cache: "no-store" },
        );
        const data = await result.json();
        if (!result.ok)
          throw new Error(
            data.error ?? "Pencarian gagal. Coba ulang kata kunci.",
          );
        if (!abort.signal.aborted) setResponse(data);
      } catch (error) {
        if (!abort.signal.aborted)
          setResponse({
            query: value,
            results: [],
            error:
              error instanceof Error
                ? error.message
                : "Pencarian gagal. Coba lagi.",
          });
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      abort.abort();
    };
  }, [value, open]);
  const features = navigation
    .filter(
      (item) =>
        (!item.permission || can(actor, item.permission)) &&
        `${item.label} ${item.group}`
          .toLocaleLowerCase("id")
          .includes(value.toLocaleLowerCase("id")),
    )
    .map((item) => ({
      id: item.href,
      type: "feature",
      label: item.label,
      detail: item.group,
      href: item.href,
      icon: item.icon,
    }));
  const groups: SearchGroup[] = features.length
    ? [{ label: "Fitur", items: features }]
    : [];
  if (response?.query === value && value.length >= 2) {
    const records = response.results.map((item) => ({
      ...item,
      icon:
        navigation.find((n) => n.href === `/${item.type}`)?.icon ??
        MagnifyingGlassIcon,
    }));
    if (records.length)
      groups.push({ label: "Data yang dapat Anda akses", items: records });
  }
  function change(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setQuery("");
      setResponse(undefined);
    }
  }
  function select(item: SearchItem) {
    const target = new URL(item.href, "http://sgi.local");
    target.searchParams.set("role", role);
    if (target.searchParams.has("record"))
      target.searchParams.set("open", String(Date.now()));
    change(false);
    router.push(target.pathname + target.search + target.hash);
  }
  return (
    <CommandPalette.Root
      open={open}
      onOpenChange={change}
      items={groups}
      value={query}
      onValueChange={setQuery}
      itemToStringValue={(group) => group.label}
      getSelectableItems={(items) => items.flatMap((group) => group.items)}
      onSelect={select}
    >
      <CommandPalette.Input
        placeholder="Cari fitur, nomor job, customer, invoice…"
        aria-label="Cari fitur dan data SGI"
        maxLength={100}
      />
      <CommandPalette.List>
        <CommandPalette.Results>
          {(group: SearchGroup) => (
            <CommandPalette.Group key={group.label} items={group.items}>
              <CommandPalette.GroupLabel>
                {group.label}
              </CommandPalette.GroupLabel>
              <CommandPalette.Items>
                {(item: SearchItem) => (
                  <CommandPalette.Item
                    key={item.id}
                    value={item}
                    onClick={() => select(item)}
                  >
                    <item.icon
                      size={20}
                      className="search-result-icon"
                      aria-hidden="true"
                    />
                    <span className="search-result-copy">
                      <Text as="span">{item.label}</Text>
                      <Text as="span" variant="secondary">
                        {item.detail}
                      </Text>
                    </span>
                  </CommandPalette.Item>
                )}
              </CommandPalette.Items>
            </CommandPalette.Group>
          )}
        </CommandPalette.Results>
        {value.length >= 2 && response?.query !== value && (
          <CommandPalette.Loading />
        )}
        {response?.query === value && response.error && (
          <div role="alert" className="search-feedback">
            <Banner variant="error" description={response.error} />
          </div>
        )}
        {(value.length < 2 || response?.query === value) &&
          !response?.error && (
            <CommandPalette.Empty>
              {value.length < 2
                ? "Ketik minimal dua karakter untuk mencari data."
                : "Tidak ada hasil. Coba nomor job, nama customer, atau kata kunci lain."}
            </CommandPalette.Empty>
          )}
      </CommandPalette.List>
      <CommandPalette.Footer>
        ↑ ↓ pilih · Enter buka · Esc tutup · Data sesuai izin Anda
      </CommandPalette.Footer>
    </CommandPalette.Root>
  );
}
