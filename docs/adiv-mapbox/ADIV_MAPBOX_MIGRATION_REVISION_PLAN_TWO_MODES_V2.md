# ADiV — Mapbox Migration, Offline Navigation & Transparent Activity Sharing (Two Riding Modes)

**Document type:** Incremental migration / engineering plan, not implementation evidence  
**Revision:** v2.1 — Two riding modes + three post-ride share templates; supersedes the previous two-mode migration document  
**Prepared:** 2026-11-03  
**Status:** Planning only; two-mode product scope; agent must audit the real repository before implementation  
**Project:** Existing ADiV Expo + React Native + TypeScript app, with Convex  
**Baseline documents:** `ADIV_OFFLINE_MAPS_NAVIGATION_MASTER_PLAN.md` and `ADIV_AGENT_KICKOFF_PROMPT.md` (2026-11-02). The user reports that their prior agent implemented that baseline; verify actual files and test evidence before assuming any particular feature works.
**Revision to prior Mapbox plan:** The standalone **Navigate Only** product mode remains **removed**. The only two ADiV riding modes are **Record Only** and **Navigate + Record**. Both generate the same three offline-capable post-ride sharing formats: **Route Only**, **Statistics Only**, and **Route + Statistics**. These are **share templates, not riding modes**. The design uses the actual recorded GPS trace, not the navigation-planned polyline. Existing app code and tests must be audited before treating any feature as already delivered.

## 0. Executive decision

Migrate **map rendering and turn-by-turn navigation** to Mapbox as the preferred unified vendor, but **do not delete the existing working MapLibre/OSM/PMTiles/Valhalla implementation until Mapbox demonstrates offline parity on a real phone**. Preserve local ride recording, SQLite, the durable sync outbox, Convex, ride summaries, offline search, maintenance workflows, **transparent route/statistics PNG exports**, and GPX history. Treat this as an incremental *replacement of selected providers* with behavior-preserving adapters, not a rebuild. The public riding UX has exactly **two choices: Record Only and Navigate + Record**. A dedicated Navigate Only mode is out of scope.

**Offline remains an explicit product requirement**, including real cold-start airplane-mode rendering and on-device route calculation/recalculation within downloaded regions. Mapbox native Navigation SDK v3 supports offline regions via `TileStore` and predictive caching, but `@rnmapbox/navigation` 0.1.0 does **not** expose an explicit offline routing-management API. A verified local Expo native bridge or patch may be necessary. Do not assume JavaScript wrapper availability just because native SDK documentation describes a feature.

**Commercial/product nuance:** Mapbox is commercial (even for a personal app); free tiers are usage-based, subject to current account terms. The Mapbox Android Offline Search SDK is a **premium** feature, not bundled in the basic free tier. Keep existing independent SQLite/OSM-derived offline destination search as the default until there is an explicit reason and approval to change it. This is a deliberate *hybrid data source*, not an additional map renderer or route engine.

**Coverage nuance:** The old specification required **the entire Philippines offline**. Do not silently remove that requirement. Mapbox's documented default limit is **750 unique offline map tile packs per device** (not 750 user-defined regions). Nationwide coverage at useful zoom levels and storage sizes is **unproven**. Validate Philippines-wide Mapbox feasibility before promising it; prioritize route corridors and regional packs for practical motorcycle use, and keep the existing nationwide solution or escalate a product tradeoff if Mapbox cannot meet parity.

## 1. Why this revision exists

Previous implemented design (to be verified by repository audit):

- Map rendering: MapLibre React Native, OSM/Geofabrik tiles converted to PMTiles, offline styles and labels.
- Offline navigation: Valhalla Mobile graph, native Expo module, local maneuver/reroute engine.
- Offline search: local SQLite FTS / PH-derived place index with pin and coordinate fallback.
- Ride recording: local location service + background task + SQLite ride points/statistics.
- Synchronization: local outbox and authenticated, idempotent Convex sync.
- Export/sharing: ride overlays, maps snapshots where available, GPX and files.

Target *provider* design, gated by device proofs:

- Interactive map: `@rnmapbox/maps` Mapbox Maps SDK.
- Navigation: `@rnmapbox/navigation` (community pre-1.0 wrapper on Mapbox Navigation SDK v3) **only if tested**; add the smallest native offline bridge needed, or implement a minimal native integration if the wrapper is unsuitable.
- Offline map: Mapbox style pack + tile regions using OfflineManager/TileStore; download legally from Mapbox, *not* PMTiles repackaged from Mapbox.
- Offline routing: Mapbox Navigation SDK native `TileStore` **routing tiles** and on-board routing, with offline off-route rerouting.
- Offline search: **keep existing SQLite index**, not Mapbox premium Offline Search.
- Data/recording: keep existing working implementations and reuse navigation location updates where safe. Ride recorder remains operational without Mapbox guidance.
- No parallel installation of every map/routing alternative in the final production build unless parity analysis specifically requires a fallback and the user approves its storage/build costs.

## 2. Non-negotiable preservation rules

1. Existing screens, routes, app state, user accounts, auth, Convex API, maintenance records, fuel logs, favorite destinations, saved rides, stored GPS points, local SQLite data, imports/exports, and user settings must remain intact.
2. No destructive database migrations. Any schema migration must preserve IDs, raw GPS points, existing ride stats/history and pending sync work. Include backup/recovery and tested downgrade behavior.
3. **Record-only must work with no map, navigation session, token validation request, or internet** when the OS permits GPS. Do not start Mapbox Free Drive merely to track or paint the user's location.
4. **Navigate + Record must save the actual traveled GPS trace**, not just the planned route geometry. Navigation and recorder have independent lifecycle controls; no standalone Navigate Only entry point is allowed. The rider may pause recording while guidance is active, but that does not create a separate product mode.
5. Preserve offline maintenance/ride edits and eventual authenticated Convex synchronization. Do not send all location samples to Convex in real time.
6. Keep Philippine-only offline download scope, while clearly differentiating `nationwide`, `regional`, and `route corridor` coverage. Do not claim nationwide parity without evidence.
7. No hardcoded account secrets. Mapbox public access token may live in the supported public configuration; never ship a secret `sk.*` token or a privileged downloads token in the app.
8. Follow `AGENTS.md`, `CLAUDE.md`, current project conventions, package manager and release process. No sweeping refactors.
9. No new offline mode that silently makes HTTP requests; measure requests with network blocked as well as ordinary airplane mode.
10. Physical-device testing is required; Expo Go alone cannot prove native navigation compatibility. Label platform coverage accurately.
11. **Google Maps is an external alternative** when the rider only needs turn-by-turn guidance. In ADiV, they may use **Record Only** while running Google Maps separately; preserve/background-test ride recording while another app is foregrounded, with OS restrictions disclosed. Do not build an in-app Google Maps integration or use Google SDKs merely for this workflow.
12. A two-mode UI does **not** automatically lower Mapbox per-trip billing. Avoid Mapbox Active Guidance entirely on Record Only; start it only for explicit Navigate + Record; stop it promptly on guidance end. Opening Mapbox maps may still count a Maps SDK MAU, and optional independent APIs may have separate usage.

## 3. Mapbox capabilities and verified caveats

| Capability | Mapbox native support | React Native / ADiV migration constraint |
|---|---|---|
| Interactive styled maps, 3D, route layers | Maps SDK | Use `@rnmapbox/maps`; preserve overlays and theme |
| Active guidance, voice, ETA, reroutes | Navigation SDK v3 | `@rnmapbox/navigation` is pre-1.0; test real guidance |
| Offline maps | Maps OfflineManager + style pack and tile regions | Verify style glyphs/sprites, zoom ranges, region geometry, restart |
| Offline routing and rerouting | Navigation SDK v3 with downloaded routing tiles (`TileStore`) | Wrapper does **not** expose explicit offline setup; native proof essential |
| Predictive caching | Native SDK | Helpful for travel, **not** a substitute for guaranteed predownloaded coverage |
| Offline search | Mapbox product exists | Android Offline Search is premium; retain existing local index |
| Live traffic | Online service, coverage dependent | Offline: do **not** promise live conditions or traffic-based ETA |
| Motorbike-specific legal routes | No generally available dedicated motorcycle Directions profile | Treat vehicle mode as driving baseline; validate roads, toll/motorcycle restrictions and ferries |
| All-Philippines offline | Unverified | 750 unique tile-pack limit + disk/zoom constraints; test |
| Mapbox navigation billing | Metered Navigation SDK trips/MAUs | GPS recording by itself should generate **zero** navigation trips |

### Compatibility facts to revalidate against the repo

At document preparation, community `@rnmapbox/navigation` docs describe version **0.1.0**, requiring React Native **0.79+ New Architecture**, `@rnmapbox/maps` **>=10.3.16 <10.4.0**, native Navigation SDK **3.33.0** and pinned Maps SDK **11.33.0**. Android requires minSDK 24 and compileSDK 36; its Expo plugin is documented as tested only with Expo SDK 58, and live real-device guidance/release builds are flagged as not yet tested by the library maintainers. These constraints are **not installation instructions**: the agent must confirm current releases, the actual ADiV SDK/Gradle/Xcode versions, and exact peer dependency graph before choosing pins. Expo development/native build required.

Sources:
- https://rnmapbox.github.io/docs/navigation/overview
- https://rnmapbox.github.io/docs/navigation/install
- https://docs.mapbox.com/android/navigation/guides/advanced/offline/
- https://docs.mapbox.com/ios/navigation/guides/advanced/offline/
- https://docs.mapbox.com/android/maps/guides/offline/manage-offline-data/
- https://docs.mapbox.com/android/search/guides/search-engine/offline/
- https://docs.mapbox.com/android/navigation/guides/pricing/
- https://www.mapbox.com/pricing

## 4. Target application behavior: exactly two ride modes

**Product rule:** ADiV provides **only** two selectable riding modes: **Record Only** and **Navigate + Record**. Remove **Navigate Only** from the target UX, user settings, tabs, onboarding, action menus, documentation, planned tests and analytics events. Keep turn-by-turn functionality inside Navigate + Record; do not delete native navigation internals that power it.

### Mode A — Record Only (default, zero Mapbox navigation trips)

- Start a local GPS ride with a single action; do not ask for a destination or calculate a route.
- Open the existing map if available, but **recording must not depend on Mapbox rendering, token validation, network connectivity or any route/navigation session**. Prefer a map-optional compact recording dashboard so the app can record even if offline map coverage is unavailable.
- Track raw/filtered GPS points, timestamps, heading, accuracy, speed, distance, moving/elapsed/stopped time, pauses and stops; maintain crash recovery and SQLite durability.
- Use the existing `expo-location` / TaskManager or proven native recorder for background location, foreground notification and recovery, consistent with OS restrictions.
- Reuse existing SQLite IDs, outbox, Convex sync, ride summary, GPX and photo/route exports. **On Finish Ride, offer the shared Activity Share screen with Route Only, Statistics Only, and Route + Statistics templates.**
- **Never start Mapbox Navigation Active Guidance or Free Drive** merely to record or display a moving location. Rendering Mapbox map views may still count Maps SDK MAUs.
- **Optional external workflow:** The rider may start ADiV **Record Only**, switch to the **Google Maps app** for guidance, then return to ADiV to finish and save. This is still Record Only and should incur **zero Mapbox Navigation SDK trips**. Background recording must be tested while Google Maps is foregrounded, screen locked and after interruptions; do not assume OS guarantees.
- If map rendering fails or the user goes offline, keep recording and indicate map availability separately.

### Mode B — Navigate + Record (for unfamiliar routes and long rides)

- Provide destination search/pin/favorites and route preview **inside this mode only**, then a clear **Start Navigation + Recording** action.
- Start **one** Mapbox Active Guidance session and **one** durable local ride-recording session. If an existing Record Only ride is already active, **attach guidance to that same ride ID instead of creating a second ride**. Make the recorder ready before starting guidance; if recorder initialization fails, show a clear failure/retry or explicit switch to Record Only—do not silently become Navigate Only.
- Show planned route, next maneuver, distance to turn, ETA, voice guidance, route progress, rerouting, arrival and actual ridden GPS trail. Distinguish the planned route from the recorded path.
- Verify offline readiness for **both** downloaded map assets and native navigation routing tiles. If coverage is missing, report the exact missing capability; offer download when online or let the rider switch to Record Only. Never fake offline guidance or silently call an online routing API.
- Share the best verified GPS location source with the recorder where reliable; preserve raw location truth and a fallback recorder when navigation stops/unmounts. De-duplicate by stable sequence/time/location-quality rules and avoid multiple competing GPS watchers.
- Detours/reroutes update guidance, **never** rewrite actual GPS history. Pausing/restarting the recording is independent of guidance; show unmistakable state if the recorder is paused.
- When arriving at a destination or ending guidance, **end the billed Active Guidance session promptly**; keep the ride recording active until **Finish Ride**. Additional return legs can be started within the same ride and may count as additional Mapbox trips.
- If navigation fails/loses coverage, explicitly stop guidance billing where applicable and continue recording; show status. If local ride storage fails, surface the failure and prevent silent loss or phantom recorded points.
- On ride completion, preserve ride summary, actual-route GPX/image export, SQLite history and Convex sync state. **Open the identical Activity Share experience used by Record Only; never export the navigation preview route instead of the recorded trail.**

### State machine and lifecycle guarantees

Use one **ride state machine**: `idle -> starting -> recording -> paused -> recording -> completed / recoverable_error`.

Only while Mode B guidance is active, also use a **guidance state machine**: `idle -> preview -> starting -> navigating -> arrived/stopped/error`.

- Record Only never enters the guidance state machine or invokes a Mapbox trip session.
- A currently active Record Only ride can enable Navigate + Record guidance without splitting the ride or duplicating stored points. When guidance ends, the same ride continues as **Record Only** without automatically finishing or starting a new ride.
- Guard against repeated taps, remount/re-render session restarts, stale callbacks, app restarts, lockscreen/Google Maps foreground transitions and missed/degraded GPS.
- Automated tests must prove there is no standalone Navigate Only action, route preview outside Mode B and no navigation session in Mode A.

### Shared post-ride sharing and transparent-overlay specification (both modes)

**Product decision:** Riding modes stay at **two**. The Activity Share screen is a post-ride feature available after **either** mode, and accessible later from saved Ride History. The attached user reference is a transparent **statistics** preview (with a checkerboard shown only in the editor); it does **not** itself include a visible route line. ADiV should additionally support transparent route geometry and a combined layout, using its **own ADiV branding** rather than copying Strava logos, names, icons or exact layout.

#### Required three share templates

| Template | Contents | Output | Default |
|---|---|---|---|
| **Route Only** | Actual recorded GPS trail as a clean stroke, optional start/end markers; no basemap | Transparent PNG | Off |
| **Statistics Only** | Actual ride distance, elapsed/moving time, average speed; optional maximum speed/date; no route | Transparent PNG | Off |
| **Route + Statistics** | Actual recorded trail plus motorcycle-oriented ride statistics | Transparent PNG | **On (recommended default)** |

- **No running/cycling pace field** such as `5:18/km` unless a future activity type actually requires it. For motorcycle rides prefer `km`, `km/h`, `h/m/s`; compute metrics from the **existing canonical ride-statistics implementation** and label moving time versus elapsed time accurately. Do not claim GPS-estimated top speed is a calibrated speedometer reading.
- Template selection must not mutate the saved ride, its points, navigation status, statistics, or Convex data. An offline export is a *read-only transformation* of saved local GPS points/summary.
- **Route Only and Route + Statistics use the actual recorded GPS coordinates** (including detours/re-routes), not the planned Mapbox navigation route, route preview, snap-to-road replacement, or fictional straight-line interpolation through missing samples.
- An active ride can show a local preview, but the canonical export is produced from committed samples; do not claim the ride is complete or its stats final until the user finishes it.

#### Preview, presentation and customization

1. Offer a dedicated **Share Activity** sheet/screen reachable after Finish Ride and from Ride Details/History. Start with the existing ADiV design system; preserve any working share UI instead of building duplicates.
2. Show three selectable template previews with a **checkerboard only in the preview to communicate transparency**. The **actual PNG must not contain checkerboard pixels, a flat dark rectangle, or an opaque map background**.
3. For transparent templates, render a true RGBA/alpha PNG at **1080 × 1920 (Story)** and **1080 × 1080 (Square)**. Provide an optional **high-resolution export** if memory/quality testing supports it. Preserve aspect ratio without stretching/distorting track geometry.
4. Offer route stroke color, line thickness, scaling/centering, and optional start/end dots; expose text color (light/dark) and a contrasting text halo/shadow when needed. Keep defaults compact for the rider rather than adding an elaborate editor.
5. Show distance, moving/elapsed duration and average speed by default on templates with stats; allow choosing a small number of statistics, including max speed and date if already available. Do not expose raw/home coordinates in text by default.
6. Optional separate **Photo Background** mode may let the user select a local photo and compose the transparent overlay over it, exporting an opaque final photo. Treat this as an **export background option, not a fourth ride template or riding mode**. Reuse existing image-picker/media tools if installed; do not request unrelated permissions.
7. Optional **Map Background** export uses a local SDK map snapshot *only when verified offline and permitted by provider terms*. Keep Mapbox/OSM attribution where required; do not add map screenshots or network requests as a dependency for the three transparent exports.
8. Offer **Save to Photos/Gallery**, **OS Share Sheet**, and **Instagram Story-compatible asset**. Direct Instagram Story posting/clipboard image support are **conditional platform integrations**, not guaranteed by `expo-sharing`; provide Save/Share fallback when the target application is unavailable. Do not claim that GPX or PNG sharing creates a public ride URL unless an actual backend link feature exists.
9. Continue supporting existing **GPX export** alongside PNG options. Maintain existing authorized backup/sync behavior; sharing must not change the original ride.

#### Rendering/engineering contract

- Pipeline: `SQLite saved ride + committed ride_points → filter/validated track & canonical stats → route-to-canvas transform (fit bounds, preserve aspect ratio, pad viewport) → reusable SVG/vector overlay & stat card → transparent PNG with alpha → save/share`.
- Reuse current `react-native-svg`, `react-native-view-shot`, `expo-sharing`, gallery/media APIs, or equivalent only if **present and proven**. A standard `ViewShot` capture of a native Mapbox map may produce black/blank output or opaque backgrounds; for pure transparent route/stat overlays prefer rendering independent of a Mapbox native map view. If alpha is lost, evaluate a small proven SVG-to-PNG raster path instead of installing an entire duplicate map engine.
- Normalize longitude/latitude orientation, dateline/degenerate bounding boxes and aspect ratio. Handle one-point or zero-point rides with an honest `No usable track` state and allow **Statistics Only** when valid metrics exist; never invent route geometry. Handle long ride tracks via deterministic, non-destructive drawing simplification **for preview/export only**, keeping raw SQLite GPS points unchanged.
- Sample filtering, time ordering, pauses and session boundaries must match the ride recorder's canonical stats; route export should exclude obvious GPS jumps without erasing valid detours. Preserve the full underlying trace unless the user explicitly applies a share-only privacy mask.
- Add a privacy control to **hide configurable distance near the ride's start and/or finish** (recommend a conservative default when sharing); preview exactly what will be exported, and apply the mask to route line/markers and **GPX exports when the user selects a privacy-protected GPX variant**. Warn that unmasked ride maps can reveal home/work and that photo EXIF metadata can also reveal location. The original private ride is never modified.
- Export must function after an **airplane-mode cold restart** from saved local ride data. It must cause **zero Mapbox Navigation SDK Active Guidance or Free Drive sessions**, zero Directions/Search API calls, and no necessary internet access. Opening an optional Mapbox map background may still affect Maps SDK MAU accounting; keep that action separate and explicit.
- Use private temporary files with predictable cleanup, no GPS path or auth details in filenames, logs, analytics or crash reports. Avoid permanent duplicate image blobs in Convex unless existing requirements expressly call for them.

#### Acceptance checks (after implementation approval)

- Both **Record Only** and **Navigate + Record** finished rides offer **all three templates** from the same Share Activity UI, including from historical ride detail.
- **Route Only** and **Route + Statistics** follow **recorded** GPS points even if navigation rerouted multiple times; screenshot comparison should reveal an actual traveled detour.
- PNG alpha is verified programmatically (transparent corner pixels have alpha 0 or expected antialiased values) and visually by compositing onto both light and dark photos. The UI checkerboard is **not** present in the PNG file.
- Story **1080×1920** and Square **1080×1080** exports have readable labels, preserved route proportions, non-clipped strokes and correct metric units.
- A zero/one-point ride and a noisy/long ride do not crash; statistics-only fallback works when a track cannot be meaningfully drawn.
- A local saved ride exports in airplane mode without initiating Mapbox navigation, online search/routing or Convex sync; saved GPX remains correct.
- Privacy masking genuinely removes selected start/finish portions **from exported route geometry and start/end markers**, without mutating SQLite; Save/OS Share/Instagram fallback works on physical devices.
- Rendering behavior, app memory, exported image dimensions/alpha and platform-specific results are recorded in QA evidence. **Do not mark this sharing feature done solely from a UI mockup.**

## 5. Map and routing architecture after migration

```
                     EXISTING ADiV UI / ROUTER
                             |
       ------------------------------------------------
       |                      |                       |
  Map provider         Guidance provider         Ride recorder
  @rnmapbox/maps       Mapbox Nav v3             EXISTING local engine
       |                      |                       |
       |            native bridge if needed           |
       |                      |                       |
  Style + map tiles    routing tiles/TileStore     SQLite raw GPS points
       |                      |                       |
       ------------- Device GPS event coordination ---|
                                                      |
                                       Existing durable outbox
                                                      |
                                          Existing Convex sync

Offline search: existing local SQLite FTS + saved favorites/pin/coordinates
Only Mode B can initiate route preview or a navigation session; Mode A never calls Mapbox Navigation SDK.

OLD map/routing providers retained behind feature flags UNTIL parity passes.
```

**Adapter boundaries (design contracts, not a mandate to rewrite working modules):**

- `MapAdapter`: initialize map, camera/follow, styles, overlays, offline map coverage, snapshot, map error.
- `NavigationAdapter`: Mode B only—preview, start/stop/pause if supported, progress, maneuver, route/ETA, reroute, offline coverage, errors, location events. No standalone Navigate Only UI.
- `OfflineRegionManager`: list, download, progress, verify, activate, remove, update map+navigation data; report which capabilities each region provides.
- `RideRecorder`: existing start/pause/resume/finish/recover and GPS append; independent of provider.
- `LocationCoordinator`: single source of truth and de-duplication for timestamps/sequence; never assumes navigational matched point equals raw GPS truth.
- `LocalSearchAdapter`: existing index/favorites/pin/coordinates; optional online Mapbox Search is independent and must have cost/terms approval.
- `ActivityShareExporter`: read saved points/stats, compose independent vector overlay, export true-alpha PNG for three templates and GPX with optional share-only privacy masking. **No dependency on guidance sessions or native map snapshots for transparent templates.**

Avoid premature abstraction: if existing module boundaries already do this, adapt them rather than introducing duplicates.

## 6. Offline strategy and download design

### 6.1 Offline requires at least THREE separate assets/capabilities

1. **Map display:** style pack + compatible map tile region at required zooms; offline fonts, sprites, labels, and icons.
2. **Routing:** compatible Mapbox Navigation SDK routing tiles downloaded for the intended area, with the correct dataset/profile/version; verify on-board route computation and reroute.
3. **Search:** existing local SQLite place index OR saved favorite/coordinates/map pin; do not conflate map tiles with searchable place data.

GPS receiving signals is independent of internet; voice playback may depend on installed native/offline voice assets; live traffic and current incidents are *not offline*.

### 6.2 Region strategy

- **First spike:** small Davao City area, including real maneuvers, route deviations, cold restart in airplane mode.
- **Second:** Davao -> Tagum and Davao -> Digos corridors, including adequate buffer for alternate routes and detours.
- **Third:** Davao -> Mati long ride corridor, with enough buffer for reasonable deviations; test real navigation without connection.
- **Fourth:** Mindanao regional pack if the default offline tile-pack limit and storage permit.
- **Nationwide:** entire Philippines only **after** measurements prove useful zoom, coast/island coverage, storage and the unique tile-pack cap; retain legacy nationwide offline if this cannot be achieved and document a clear user decision.
- Potential Luzon/Visayas/Mindanao regions are optional refinements *subject to feasibility*; do not promise every province offline under Mapbox alone.

### 6.3 Offline region manager UX

For each installed item show:

- Region name, coverage polygon/route corridor, approximate zoom range and exact measured storage bytes.
- Map status: `not_downloaded / downloading / ready / incomplete / expired / error`.
- Routing status: `not_downloaded / downloading / ready / incompatible / expired / error`.
- Search status: `local_index_ready / limited / unavailable`.
- Source/version/time last verified and last updated; progress, Wi-Fi-only preference, retry, delete and low-space warnings.
- Specific button/flow: **Download for Offline Navigation** downloads **both** map and route data, verifies both and only then labels `Offline navigation ready`.
- **Prepare My Ride (Mode B only)**: after a route preview, download appropriate regions/corridor while online and perform an offline readiness check; do not confuse opportunistic predictive cache with guaranteed coverage.
- When route begins outside coverage, show which portion is missing and warn before enabling offline assurance.
- Never update or delete active region data while a route is using it; maintain old functioning copy until staged update verified.

### 6.4 TileStore/native proof

Verify an integration where the **same compatible TileStore** is configured for map and navigation SDKs, with both map and routing tile descriptors. Confirm `TileStore` / native SDK lifecycles. Verify whether map JS offline APIs + native Navigation bridge share the same underlying store or require an explicit path/config; prove through code and device logs, not assumption. Test navigation when Wi-Fi/mobile data disabled *before app launch*, including off-route recalculation.

Validate token/network behavior when offline, cache refresh/expiration, real storage usage, the 750 unique map tile-pack cap, available zoom levels and Mapbox terms. Do **not** scrape Mapbox tiles or convert/download their entire dataset into redistributed PMTiles.

### 6.5 Do not remove the current Philippine offline assets yet

Existing OSM-generated PMTiles, routing graph, offline place index, and their license/attribution remain fully functional during transition unless a native dependency conflict makes coexistence impossible. If coexistence in one binary is impractical, use a separate spike branch/build; do not delete the old implementation to make the new one compile. The rollback can be branch/build-level rather than live feature toggle. Any OSM-derived asset that remains must retain its attribution and ODbL obligations.

## 7. Cost model and protection

As verified on 2026-11-03, Mapbox's public **Navigation SDK v3 metered-trip** pricing page lists **up to 100 navigation MAUs and 1,000 trips per billing month free**, then rates depending on the tier. Mapbox mobile Maps SDK has a separately metered MAU category; search/geocoding, directions requests outside navigation, and other products may bill separately. These are **usage allowances, not spending caps**, and can change. Confirm the selected account, billing period and current plan before adopting.

How trips can be counted:

- Active Guidance begins after navigation starts with route loaded; each started waypoint leg counts as a trip; a single long leg can last up to 12 hours before another trip is counted.
- Free Drive (no route) is billed per hour; do not start Free Drive for recording only.
- Mapbox SDK requests within an active Nav session have its inclusion rules; route previews outside sessions and separate Search requests can be independently billed.
- Recording local GPS or persisting to SQLite/Convex does **not** itself create a Mapbox trip.
- **Rendering a transparent share overlay from SQLite creates no Mapbox Navigation trip**. Keep it independent of map/native routing SDKs. A user-requested Mapbox basemap snapshot may still count as Maps SDK usage and must preserve required attribution.
- **Removing Navigate Only does not make Navigate + Record cheaper per navigation leg.** Savings occur only when the user chooses Record Only (including while separately using the Google Maps app) rather than starting Mapbox guidance. Do not promise a particular savings percentage.
- Maps SDK MAU and navigation MAU are distinct products; using both may show separate line items.

For 3–5 personal ride days per month, especially if many rides use Record Only, usage should normally fit comfortably in the published free navigation allowance, **not a promise of a zero bill**. Plan to instrument only aggregate counts (no raw location), set Mapbox billing alerts, regularly check account Statistics, avoid unintended sessions, and never treat alerts as a hard cap. Set sensible search debounce/request budgets if optional online search is added. Explicitly block premium Offline Search unless user separately authorizes pricing.

## 8. Native/build/security/licensing audit

Before selecting packages check:

- Current Expo SDK, React Native, New Architecture enabled, exact `@rnmapbox/maps` peer range, Android min/compile/target SDK, Gradle/Kotlin, supported ABIs, iOS deployment/Xcode/Swift, CI/EAS development/release builds.
- Existing MapLibre, Expo native Valhalla module and generated prebuild folders; whether coexistence causes duplicated symbols or native map library conflict.
- Only one native Mapbox Maps SDK version actually linked to Navigation SDK; compare official pinned dependencies.
- Expo config plugins ordering, native permissions, background location/foreground service, voice/audio background mode and lifecycle.
- Public Mapbox token and Android/iOS app restrictions; no secret token in commits/screenshots/crash logs. Document token provisioning for development and release builds.
- Mapbox attribution, legal use of downloaded regions, Mapbox-specific branding requirements and OSM attribution for retained assets.
- Clear app consent for private GPS recording, safe display, and correct per-user Convex authorization.
- Do not embed or resell downloaded Mapbox tile/route datasets as standalone redistribution packs without explicit rights.

## 9. Planning phases, gates, and post-plan implementation roadmap

**Important: this document proposes phases. The new agent prompt below requests a PLAN ONLY first. Implementation requires user approval after audit.**

### P0 — Repository reality audit (plan now)

Inventory actual old provider modules and prove what was implemented. Compare prior specification to code and tests. Build a reuse/replace/retain/delete table with paths. Run safe read-only checks or baseline tests only with no source modifications, per agent capabilities. Record exact package versions, pending sync/data migration risk, GPS behaviors and release readiness.

**Output:** `docs/adiv-mapbox/00-existing-system-audit.md`; evidence matrix showing `implemented / partially implemented / not found / unverified`.

### P1 — Compatibility and vendor decision (plan now, spike after approval)

Investigate native wrapper/API gaps; verify current Mapbox documentation, license, terms, exact versions, Android/iOS build constraints, free/paid usage. Define a feasibility spike no more complex than needed to answer: can ADiV use Mapbox map + active guidance + **new offline route and reroute with no internet**? Consider whether a small Expo native module is needed, and a fall-back design if wrapper fails.

**Gate A:** selected SDK/version compatibility and a complete spike recipe with pass/fail conditions.

### P2 — Parallel proof-of-concept spikes (after plan approval)

1. `spike/mapbox-map`: render online and cold-start offline with downloaded map style/tile region, route display and captured storage/tile-pack usage.
2. `spike/mapbox-navigation`: one on-device Active Guidance trip, voice, ETA and reroute, with route tiles prepared and *new* offline route after airplane-mode restart.
3. `spike/adiv-recording-integration`: prove existing recorder survives new provider start/stop and records actual GPS samples through lockscreen/background where the platform permits.

Separate worktrees and file ownership; one integration agent merges only after review. Do not edit overlapping native configs concurrently.

**Gate B:** verified real Android physical-device evidence for map, route and offline reroute, one combined Navigate + Record session, no ride loss, measured storage/battery, and all build/permissions documented. Independently prove iOS before marking iOS supported.

### P3 — Adapter migration (after Gate B)

Add or adapt provider boundaries; switch maps UI and guidance behind gated configuration; retain old provider while new sessions/routes and ride exports are checked; map/route styling matches ADiV UI. No duplicate Nav session, location watcher or route polyline.

**Gate C:** existing UI + old data remain functional; recording modes pass end-to-end; QA can switch to tested old build without data loss.

### P4 — Offline manager conversion (after Gate B/C)

Replace PMTiles/Valhalla *download experience* with Mapbox offline map/routing regions, compatibility metadata and pre-ride readiness check. Keep SQLite search. Handle interrupted/corrupt downloads, low storage, stale region data, app restart, version updates, eviction and deletion.

**Gate D:** required regional routes work in airplane mode after fresh restart, with no network calls. Nationwide capability explicitly measured; unresolved limitation documented and approved rather than hidden.

### P5 — Ride lifecycle, share/export pipeline, sync regression and billing (after P3/P4)

Test both modes; include **Record Only while external Google Maps is foregrounded**, background/lockscreen, pause/resume, actual route vs planned, GPS accuracy filtering, battery and memory, recovery, arrival vs record completion, duplicate prevention, GPX/image snapshots, auth/account switch and replay-safe Convex uploads. **In this phase, audit/reuse the existing share components and plan/implement all three transparent export templates** (Route Only, Statistics Only, Route + Statistics), story/square dimensions, alpha correctness, privacy masking, optional photo composition, Save/OS Share and Instagram fallback. Verify transparent exports work offline, use the actual saved trace, preserve raw data and create zero Mapbox navigation sessions. Verify billing usage metrics and ability to avoid idle sessions.

**Gate E:** no changes to existing data correctness and privacy; meaningful device coverage; usage within budget in observed test period (not assuming all free); all three share templates validated on a real device for **both** riding modes with true-alpha PNG exports and no extra navigation usage.

### P6 — Safe cleanup/release (only after Gates A–E)

Delete obsolete MapLibre/Valhalla runtime dependencies **only after** no caller or supported fallback remains and rollback build exists. Update docs, attribution/licenses, lockfiles and native configuration. Keep current local SQLite search and ride data. Release a versioned build with backup instructions and release notes.

**Gate F:** tests pass and rollback is validated. If offline parity or nationwide coverage is not viable, STOP and request user decision rather than removing working features.

## 10. Required test / acceptance matrix

| Test | Acceptance criterion |
|---|---|
| Existing history and maintenance | Old rides/points/stats, maintenance, fuel, offline edits intact after migration |
| Only two riding modes shown | Record Only and Navigate + Record; no Navigate Only entry point, hidden route button, or accidental third mode |
| Record Only, airplane mode | Raw GPS points and stats persist; zero Mapbox Nav sessions |
| Record Only + external Google Maps | ADiV continues local GPS recording while Google Maps is foregrounded, as OS permits; no Mapbox Nav session |
| Navigate + Record, online | One Active Guidance session plus independently saved actual GPS trace, voice/ETA/maneuver/reroute |
| Offline map after cold restart | Previously downloaded region shows labels/styles in airplane mode with zero requests |
| Offline NEW route | Calculate a new A-to-B route with internet disabled before app launch |
| Offline reroute | Force genuine off-route movement and observe new local route without online API |
| Offline voice | Tested local voice works, or explicit visual-only fallback provided |
| Offline destination | Existing SQLite index, pin and coordinate input work with no connection |
| Davao City | Guidance turns and route actual road positions plausible |
| Davao–Tagum / Digos | Regional/corridor map and routing coverage including deviation buffer |
| Davao–Mati | Simulate/verify long route, stopped time, ETA and optional multi-stop recording |
| Samal/ferry | Do not fabricate ferry availability/schedules; show route uncertainty |
| Missing tiles/region | Explicit unavailable warning; recorder continues; no fake offline success |
| Low storage/cancel/update | Partial download not marked ready; existing pack not corrupted |
| App background / phone lock | Route/ride continue as platform permits; interruption visible; no phantom points |
| Crash/restart | Previously committed GPS samples and pending outbox survive; useful recovery |
| Route finish with active ride | Guidance ends promptly, ride recording continues; rider can start a return-leg Navigate + Record guidance session within the same ride |
| GPS source switch | No double samples, inaccurate-jump spikes, incorrect distance inflation |
| Sync idempotency | Retried offline uploads do not duplicate rides or GPS points |
| Mapbox billing instrumentation | Record expected Active Guidance/Free Drive/MAU classes without GPS payloads |
| Mapbox limits/storage | Measure region sizes, 750 unique tile-pack feasibility, useful zoom, update constraints |
| Share Activity access | The identical three-template selector appears after both modes and from saved ride history |
| Transparent Route Only | Actual saved GPS track, no planned route, real PNG alpha, no checkerboard exported |
| Transparent Statistics Only | Motorcycle metrics (`km`, `km/h`, moving/elapsed time); accurate labels; true PNG alpha |
| Transparent Route + Statistics | Combined composition readable, actual detours shown, true alpha; default template |
| Image dimensions | Story 1080×1920 and Square 1080×1080, no clipping/distortion; high-resolution optional |
| Offline image export | Saved ride exports after airplane-mode cold start with zero Mapbox Nav sessions/API requests |
| Share-only privacy | Start/end masking removes sensitive geometry and markers from export; original SQLite ride unchanged |
| Sharing targets | Gallery save and OS share sheet work on device; Instagram Story asset and fallbacks validated |
| Export edge cases | No/one-point ride, GPS jumps, long route, low storage and save/share failures are safe |
| Exports | Existing GPX, snapshot/photo overlay and old ride history stay functional; underlying actual track preserved |
| Privacy/security | No coordinates/tokens in logging, no cross-account Convex reads, proper access rules |
| iOS | Do not claim supported before separate build and device QA |

Test a **small automated fixture** for billing lifecycle: starting/stopping Record Only should never invoke `startTripSession`; only Mode B starts a guidance session; finish/arrival promptly ends it; re-render/unmount does not restart sessions. Validate with native event logs (no location contents) and Mapbox dashboard when available.

## 11. Risk register and decision policies

| Risk | Severity | Response |
|---|---|---|
| React Native navigation wrapper doesn't expose offline tile setup | Critical | Native bridge proof; no removal of Valhalla until proven |
| Package version / Expo native conflict | Critical | Exact compatibility matrix, isolated build spike, rollback |
| Nationwide Mapbox offline exceeding tile-pack/storage cap | Critical | Measure before scope change; retain old PH pack or obtain user decision |
| Search SDK premium billing | High | Retain SQLite local search; no Mapbox Offline Search without approval |
| Offline map downloaded without route tiles | High | Separate readiness status and atomic `Offline navigation ready` gate |
| Background tracking unreliable when Nav view unmounts | High | Recorder-independent location lifecycle; phone locked tests |
| Duplicated GPS events | High | Single coordinator or stable sequence/time/accuracy de-duplication |
| Mapbox Free Drive sessions started unintentionally | Medium | Record Only requires zero navigation sessions; test while Google Maps is foregrounded |
| Paid usage from preview/search or extra accounts/devices | Medium | Usage budget/alerts and chosen API audit |
| OSM vs Mapbox attribution / tile rights | High | Preserve attributions; no bulk export of Mapbox tile content |
| Data/migration rollback broken | Critical | No destructive schema, backups, release gates |
| Wrong motorcycle access/tolls/ferry route | High | No motorcycle-specific guarantee; PH route/safety fixtures |
| Inaccurate offline voice/traffic promise | Medium | Feature-specific offline readiness messaging |
| Native map snapshot loses alpha/appears black | High | Render route/stat overlays independently of Mapbox map view; alpha-pixel QA |
| Planned route exported as real ride or pace used for motorcycle | High | Render actual committed GPS points + ride-specific speed/duration metrics |
| Photo/route sharing reveals private location | High | Start/end masking, EXIF awareness, local-only export, no route logs |

## 12. Proposed repository deliverables

**During PLAN-ONLY work**, the agent should create/update documentation only (if write permission is allowed):

- `docs/adiv-mapbox/00-existing-system-audit.md` — current files, existing features, versions, baseline tests.
- `docs/adiv-mapbox/01-migration-delta.md` — exact reuse/replace/remove table, file impact and user-visible differences.
- `docs/adiv-mapbox/02-compatibility-feasibility.md` — SDK pins, wrapper risks, native bridge design, evidence links.
- `docs/adiv-mapbox/03-offline-parity.md` — Philippine coverage plans, map+routing+search readiness, nationwide feasibility tests.
- `docs/adiv-mapbox/04-navigation-ride-lifecycle.md` — exactly two modes, no Navigate Only, events, external Google Maps + background recording, location source and edge states.
- `docs/adiv-mapbox/05-cost-security-licensing.md` — usage accounting, tokens, privacy and license concerns.
- `docs/adiv-mapbox/06-implementation-roadmap.md` — phases, owners/worktrees, PR order, release gates and rollback.
- `docs/adiv-mapbox/07-qa-acceptance.md` — practical on-device test matrix, including alpha/Story/Instagram export checks.
- `docs/adiv-mapbox/08-activity-sharing.md` — **only if not merged into MIGRATION_PLAN.md**: three template formats, SVG/PNG rendering, offline/alpha validation, ride privacy and share integration.
- `docs/adiv-mapbox/adr/` — short ADRs only for actual disputed decisions.

If user wants a single planning artifact, the agent can consolidate these into `docs/adiv-mapbox/MIGRATION_PLAN.md` with anchors rather than create excessive files. Follow the repo's documentation structure and avoid duplicate plans.

**Expected source-touch areas after approval (audit first, do not invent paths):** native Expo config, lockfile, map provider/components/screens, navigation provider and events, offline region manager, ride/location orchestration, minimal permission changes, test fixtures. No Convex schema changes are expected unless actual gaps are documented.

## 13. Definition of done

The Mapbox migration is complete **only when**:

- A physical device shows Mapbox maps and turn-by-turn guidance online.
- Mapbox map styles/tiles AND native routing tiles are available offline for approved Philippine test regions.
- A new offline route and off-route reroute both work after an airplane-mode cold start without external requests.
- Only Record Only and Navigate + Record are selectable; Record Only never starts Mapbox navigation, and Mode B always records the actual ride while navigating.
- Saved original GPS traces and SQLite/Convex sync remain intact; export and summary functions still work.
- **Both modes** produce **Route Only**, **Statistics Only**, and **Route + Statistics** share templates from saved actual ride data, in true-transparent Story/Square PNGs, offline, without any new Mapbox Nav trip. Save/OS Share and privacy-masked outputs pass physical-device QA; no Strava branding is copied.
- Existing UI features, permissions, privacy, app performance, and account isolation pass regression tests.
- Billing/usage is understood and telemetry detects unintended navigation sessions; usage alerts are configured by the account owner.
- Any reduction of nationwide offline coverage is explicitly disclosed and accepted; no silent loss of the prior full-Philippines objective.
- Obsolete libraries are removed only after compatibility, parity, rollback and real-device release gates pass.

**If a Mapbox integration fails to meet true offline capability, do not claim the migration is done. Maintain the working existing offline solution and escalate evidence-backed options for decision.**
