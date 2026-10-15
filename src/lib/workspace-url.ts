export type PageQuery = Record<string, string | string[] | undefined>;

/** Workspace selection is a server preference, never part of a page URL. */
export function cleanWorkspaceHref(path: string) {
  if (
    !path.startsWith("/") ||
    path.startsWith("//") ||
    path.startsWith("/api/")
  )
    return path;
  const url = new URL(path, "http://sgi.local");
  url.searchParams.delete("role");
  return url.pathname + url.search + url.hash;
}

export function canonicalPageHref(path: string, query: PageQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key === "role" || value === undefined) continue;
    for (const entry of Array.isArray(value) ? value : [value])
      params.append(key, entry);
  }
  return path + (params.size ? `?${params}` : "");
}
