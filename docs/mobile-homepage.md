# Mobile homepage reference and scope

Reference: user-supplied Klarna screenshot, 1125 × 2556. Working viewport: 390 px (phone layout below 640 px; tablet/desktop keep the enterprise dashboard). The screen uses SGI branding and real logistics content. It does not reproduce the device status bar, third-party branding, retail advertising or fabricated balances.

| Reference arrangement                | SGI implementation                                                                               |
| ------------------------------------ | ------------------------------------------------------------------------------------------------ |
| Brand and three circular actions     | SGI One; all features, attention center, account/preferences                                     |
| Wide capsule search                  | Kumo Button opening the real global CommandPalette                                               |
| Five icon shortcuts                  | Role defaults, with up to five editable favorites                                                |
| Dismissible contextual banner        | Role-specific attention from actual workspace data                                               |
| Lower sheet with rounded top         | Solid recessed Kumo surface with a distinct upper warm SGI surface                               |
| Two compact summary cards            | Actual operational/accounting/account counts or director IDR receivable                          |
| Four status shortcuts and action row | Actual role-specific counts linking to modules and supported filters                             |
| Further feature icons                | All permitted features for selected workspace role, including Analitik and Peta where authorized |
| Lower contextual card                | A useful map/analytics action rather than an advertisement                                       |
| Bottom navigation                    | Earlier user-requested floating SGI bar, with central role action retained                       |

Spacing at 390 px: 20 px side gutters; header actions 36 px; search 44 px; shortcut icons 46 px; five favorite columns above and six feature columns below (five on 320 px); summary cards at least 76 px; four equal status columns with aligned two-line label areas; lower sheet top radius 28 px. Body/control labels remain 14 px per AGENTS. Solid SGI white/orange/black replaces the reference pink/lilac gradient per brand requirements. These intentional adaptations mean this is not a pixel-identical copy of Klarna.

The homepage reference applies only below 640 px. At 640 px and above, `/home` and `/dashboard` render the previous role dashboard: official Kumo sidebar, account header, module tabs, role identity/action panel and operational tables. No mobile icon homepage or floating navbar is rendered at tablet/desktop sizes. Phone pages omit the sidebar. The homepage scroll area ends above the floating navigation so the central action cannot cover content. Detailed role analytics remain in Analitik. Charts use Kumo Chart with a minimal ECharts bar/canvas setup and a textual value summary.

Personalization is device-local, namespaced by authenticated user ID and selected role; it never grants access. Backend data uses the current DB roles; workspace selection narrows the dashboard query. Map authorization uses the existing jobsRead/jobsWrite rules; assignment scoping applies to Field. Coordinate updates use a locked transaction and append-only audit. Seed map points are approximate city coordinates for explicitly synthetic demo jobs only.

Photo reports remain backed by private R2. Maps add persisted origin/destination points, not continuous GPS, route/ETA computation or geocoding. The map remains useful with empty coordinate records: Operations can set them; readers see an explicit missing-location state. Tile failures have an explicit error and a usable text list. Favorites are not synchronized across devices; the attention center is a read-only real-data summary, not push notifications.

Map tile requests explicitly use strict-origin-when-cross-origin referrer policy, as OSM requires a Referer. This transmits only the site origin, not job IDs, query parameters, customer labels or report contents. The application-wide same-origin policy remains in place for other requests.
