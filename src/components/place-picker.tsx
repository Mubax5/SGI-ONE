"use client";
import {
  Autocomplete,
  Button,
  LinkButton,
  Loader,
  Text,
} from "@cloudflare/kumo";
import {
  ArrowSquareOutIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./shared";
import { MapPointPicker } from "./map-point-picker";
import { mapSearchLink, type MapPoint } from "@/lib/map-links";
import {
  PLACE_PREVIEW_LIMIT,
  PLACE_SEARCH_DELAY,
  placeAddress,
  placeTitle,
} from "@/lib/place-search";
import { workspaceHeaders } from "@/lib/live-data";

type SearchResponse = { rows: MapPoint[]; unavailable: boolean };
export function PlacePicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: MapPoint;
  onChange: (point: MapPoint) => void;
}) {
  const [query, setQuery] = useState(""),
    [response, setResponse] = useState<SearchResponse>(),
    [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false),
    [manualSearch, setManualSearch] = useState(false),
    [error, setError] = useState(""),
    [open, setOpen] = useState(false);
  const requestId = useRef(0),
    selectionId = useRef(0),
    skipQuery = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null),
    timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const highlighted = useRef<MapPoint | undefined>(undefined);
  const rows = response?.rows ?? [],
    preview = expanded ? rows : rows.slice(0, PLACE_PREVIEW_LIMIT);

  const cancelSearch = useCallback(() => {
    clearTimeout(timer.current);
    controller.current?.abort();
    requestId.current++;
  }, []);
  const search = useCallback(
    async function search(
      mode: "suggest" | "search",
      text: string,
      near?: MapPoint,
    ) {
      cancelSearch();
      const id = requestId.current,
        abort = new AbortController();
      controller.current = abort;
      setBusy(true);
      setManualSearch(mode === "search");
      setError("");
      const params = new URLSearchParams({ q: text.trim(), mode });
      if (near) {
        params.set("lat", String(near.lat));
        params.set("lng", String(near.lng));
      }
      try {
        const result = await fetch(`/api/places?${params}`, {
          headers: workspaceHeaders(),
          signal: abort.signal,
          cache: "no-store",
        });
        const body = await result.json();
        if (!result.ok)
          throw new Error(
            body.error || "Alamat belum dapat dicari. Coba lagi.",
          );
        if (id === requestId.current) {
          setResponse(body);
          setOpen(true);
        }
      } catch (e) {
        if (!abort.signal.aborted && id === requestId.current) {
          setError(e instanceof Error ? e.message : "Pencarian gagal.");
          setOpen(true);
        }
      } finally {
        if (id === requestId.current) setBusy(false);
      }
    },
    [cancelSearch],
  );
  useEffect(() => {
    if (query.trim().length < 3 || skipQuery.current === query) return;
    timer.current = setTimeout(
      () => void search("suggest", query, value),
      PLACE_SEARCH_DELAY,
    );
    return () => cancelSearch();
  }, [query, value, search, cancelSearch]);
  useEffect(
    () => () => {
      controller.current?.abort();
      clearTimeout(timer.current);
      requestId.current++;
      selectionId.current++;
    },
    [],
  );

  function choose(point: MapPoint) {
    cancelSearch();
    selectionId.current++;
    const title = placeTitle(point);
    skipQuery.current = title;
    setQuery(title);
    setResponse(undefined);
    setExpanded(false);
    setBusy(false);
    setOpen(false);
    setError("");
    onChange(point);
  }
  async function pick(point: MapPoint) {
    cancelSearch();
    const id = ++selectionId.current;
    skipQuery.current = query;
    setBusy(false);
    setResponse(undefined);
    setOpen(false);
    setError("");
    onChange(point);
    try {
      const address = await api<MapPoint>(
        `places/reverse?lat=${point.lat}&lng=${point.lng}`,
      );
      if (id === selectionId.current) onChange(address);
    } catch {
      /* The selected coordinates remain valid without reverse geocoding. */
    }
  }

  return (
    <div className="place-picker">
      <div
        className="place-search"
        onKeyDownCapture={(event) => {
          if (
            event.key !== "Enter" ||
            !(event.target instanceof HTMLInputElement)
          )
            return;
          event.preventDefault();
          if (open && highlighted.current) choose(highlighted.current);
          else if (query.trim().length >= 3)
            void search("search", query, value);
        }}
      >
        <div className="place-autocomplete">
          <Autocomplete<MapPoint>
            label={label}
            items={preview}
            mode="none"
            value={query}
            open={open}
            onOpenChange={(next) => setOpen(next && query.trim().length >= 3)}
            itemToStringValue={(point) => `${point.lat},${point.lng}`}
            onItemHighlighted={(point) => {
              highlighted.current = point;
            }}
            onValueChange={(next, details) => {
              const point = rows.find(
                (row) => `${row.lat},${row.lng}` === next,
              );
              if (details.reason === "item-press" && point) {
                choose(point);
                return;
              }
              if (next === query) return;
              cancelSearch();
              selectionId.current++;
              skipQuery.current = null;
              highlighted.current = undefined;
              setQuery(next);
              setResponse(undefined);
              setExpanded(false);
              setError("");
              setBusy(next.trim().length >= 3);
              setOpen(next.trim().length >= 3);
            }}
          >
            <Autocomplete.InputGroup
              className="place-search-input"
              placeholder="Cari alamat atau nama tempat…"
            />
            <Autocomplete.Content
              className="place-suggestions"
              align="start"
              side="bottom"
              sideOffset={8}
            >
              {busy && (
                <div className="place-search-status" role="status">
                  <Loader size="sm" />
                  <Text variant="secondary">Mencari lokasi…</Text>
                </div>
              )}
              {!busy && error && (
                <Text
                  variant="secondary"
                  DANGEROUS_className="place-search-status"
                  role="alert"
                >
                  {error}
                </Text>
              )}
              {!busy && !error && !rows.length && (
                <Text
                  variant="secondary"
                  DANGEROUS_className="place-search-status"
                >
                  {response?.unavailable
                    ? "Saran belum tersedia. Tekan Cari untuk mencari alamat."
                    : "Lokasi tidak ditemukan. Coba nama tempat atau daerah lain."}
                </Text>
              )}
              <Autocomplete.List className="place-suggestion-list">
                {(point: MapPoint) => (
                  <Autocomplete.Item
                    key={`${point.lat}:${point.lng}`}
                    value={point}
                  >
                    <span className="place-suggestion-content">
                      <MapPinIcon size={18} aria-hidden="true" />
                      <span className="place-suggestion-copy">
                        <Text as="strong">{placeTitle(point)}</Text>
                        <Text variant="secondary">
                          {placeAddress(point) ||
                            `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`}
                        </Text>
                      </span>
                    </span>
                  </Autocomplete.Item>
                )}
              </Autocomplete.List>
              {!!rows.length && (
                <div className="place-suggestions-footer">
                  {rows.length > PLACE_PREVIEW_LIMIT && (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setExpanded(!expanded)}
                    >
                      {expanded
                        ? "Ringkas hasil"
                        : `Tampilkan semua (${rows.length})`}
                    </Button>
                  )}
                  <LinkButton
                    href="https://www.openstreetmap.org/copyright"
                    variant="ghost"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    OpenStreetMap
                  </LinkButton>
                </div>
              )}
            </Autocomplete.Content>
          </Autocomplete>
        </div>
        <Button
          className="place-search-button"
          type="button"
          shape="square"
          variant="outline"
          title="Cari alamat"
          aria-label={`Cari alamat ${label.toLowerCase()}`}
          icon={<MagnifyingGlassIcon size={20} />}
          disabled={query.trim().length < 3}
          loading={busy && manualSearch}
          onClick={() => void search("search", query, value)}
        />
      </div>
      {value && (
        <div className="place-selected">
          <Text as="strong">{placeTitle(value)}</Text>
          {placeAddress(value) && (
            <Text variant="secondary">{placeAddress(value)}</Text>
          )}
          <div>
            <Text variant="secondary">
              {value.lat.toFixed(6)}, {value.lng.toFixed(6)}
            </Text>
            <LinkButton
              href={mapSearchLink(value)}
              variant="ghost"
              target="_blank"
              rel="noopener noreferrer"
              icon={<ArrowSquareOutIcon size={16} />}
            >
              Buka peta
            </LinkButton>
          </div>
        </div>
      )}
      <MapPointPicker value={value} onPick={(point) => void pick(point)} />
      <Text variant="secondary">
        Klik peta atau geser pin untuk menyesuaikan lokasi.
      </Text>
    </div>
  );
}
