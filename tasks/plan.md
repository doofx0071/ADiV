# Implementation Plan: ADiV Search, Navigation, and Ride Controls

## Overview

Fix the Davao pack import and search gaps, add discoverable live navigation to the Rides flow, and provide active ride metrics plus pause/resume/end actions in Android notifications. The attached screenshot is a visual reference for the navigation map and recenter control. Search data remains OpenStreetMap based; offline routing remains deferred and OSRM remains an online car-profile route provider.

## Architecture decisions

- MapLibre renders styles and vector tiles; ADiV supplies its own indexed search data and routing provider.
- Read Android picker folders through `Directory.list()` entries so Storage Access Framework URIs are used as returned by the document provider.
- Extend the versioned local FTS index to include OSM offices, schools, amenities, shops, and addresses, with compact-name aliases for joined terms such as `Sixeleven`.
- Use Photon’s OSM geocoder for bounded, debounced online search with Philippines filtering and GPS bias when available. Skip it while disconnected so pack search makes no external place-search request. Preserve pin/coordinate fallbacks. Do not promise Google/Grab business coverage or add a paid map provider.
- Keep route geometry red in preview and live navigation. The Rides page opens a navigation-first recorder flow; the camera follows the rider, allows manual pan/zoom, and has an explicit recenter control. Summary and saved ride maps must also remain directly interactive.
- Reroute after three consecutive fixes more than 120 m off route, with a 45-second cooldown. OSRM remains online-only; failed connectivity or a slow service must not leave the flow spinning indefinitely.
- Keep distance, average speed, and filtered maximum speed with the local track, saved ride and ongoing Android notification. Show metrics and the retained local route on the Rides page after saving.
- Keep the selected route visible by fitting the full route into the map when navigation recording starts; retain manual pan/zoom and recenter behavior.
- Increase the GPS distance noise floor and require movement evidence before counting a segment, reducing stationary drift in distance and average speed.
- Add an Android ongoing notification with elapsed time, distance, average/max speed, and actions. Actions update the existing SQLite ride state and foreground location tracking.
- Keep all native changes within Expo SDK 58/CNG and build the APK locally in WSL, as requested.

## Task list

### Phase 1: Pack import and place search

- [x] Fix manifest discovery and SAF folder traversal; create/check staging parents, preserve nested destinations, and include the failing pack path in copy errors.
- [x] Version the FTS schema and index named POIs, offices, schools, and address terms; add joined-name aliases.
- [x] Add Shortbread street-name and POI text layers; generate and verify Davao sample pack v1.0.1.
- [x] Replace direct Nominatim autocomplete with debounced, abortable Photon search; merge online and local results and retain pin/coordinate fallbacks. Skip online requests while disconnected.

### Checkpoint: Search works

- [x] Local search finds `V. Mapa` and `Sixeleven Mabini` in the Davao pack.
- [x] Online Photon lookup returns `Six Eleven Global Services` and `V. Mapa Street` for the example searches near Davao.
- [x] Import the pack from Android's folder picker and confirm manifest, style, checksum, and FTS5 validation on-device. Version 1.3.2 failed with a native missing-destination error; 1.3.3 exposed duplicated nested path segments; 1.3.4 fixed it and the user confirmed the pack installed.
- [x] Confirm the installed Davao pack renders in Airplane mode and local search returns results on the Xiaomi.
- [x] Confirm local search returns results for `Sixeleven Mabini` and `V. Mapa` on-device in Airplane mode.
- [ ] Improve perceived latency and scroll/tap through results on APK 1.3.5.

### Phase 2: Live navigation and recorder notification

- [x] Add a navigation-first action on Rides and wire it into the recorder destination flow.
- [x] Add a red live route, next-turn banner, follow/recenter camera control, and live trip metrics.
- [x] Add an ongoing Android ride notification with duration, distance, and Pause/Resume/End actions.
- [x] Refresh recorder state from SQLite when notification actions return the app to the foreground.
- [x] Bound Photon and OSRM requests, render local results before the online lookup completes, and explain offline rerouting behavior.
- [x] Make the ended-ride overview and saved ride map interactive; include saved ride speed stats and notification metrics.
- [x] Filter stationary GPS jitter and isolated speed spikes in ride totals.

### Checkpoint: Android build and device validation

- [x] Mobile lint/typecheck and root tests pass; local WSL APK 1.3.4 (version code 14, ARM64) installs in place and the app process launches on the Xiaomi.
- [x] Install the new pack from Downloads on the Xiaomi with APK 1.3.4.
- [x] Build local WSL APK 1.3.5 (version code 15, ARM64); verify package metadata, SHA-256, and matching signature.
- [x] Install APK 1.3.5 on the Xiaomi and verify it launches over the existing app.
- [x] Generate the nationwide `ph-philippines` v1.0.0 map/search pack from the locked 2026-10-31 Geofabrik snapshot. It covers `[112.0, 4.0, 127.2, 21.6]`, contains zoom 0–14 PMTiles, FTS5 search, local POI labels, style/glyph/sprite/license assets, and 263 SHA-256 entries. Total folder size: 578,764,053 bytes. The PMTiles verifier and manifest checks passed.
- [x] Confirm the pack's FTS5 search returns `Six Eleven Global Services` on `A. Mabini Street` and `V. Mapa` from the generated national index.
- [x] Build local WSL APK 1.3.6 (version code 16, ARM64) and verify package metadata/signature; it matches APK 1.3.5's signing certificate.
- [x] Install APK 1.3.6 over APK 1.3.5 on the Xiaomi; Android reports version code 16 and the app process is running.
- [x] Transfer the pack's 264 files to `Downloads/ADiV-Philippines-1.0.0`; on-device hashes for the manifest, map, search index, and POI labels match their PC copies.
- [x] User reports that APK 1.3.6 imported the nationwide pack from Downloads successfully.
- [x] User confirms nationwide map rendering and local `Sixeleven Mabini` / `V. Mapa` search in Airplane mode; the screen was sluggish and Navigate automatically closed the app.
- [x] Fix Android cold launch stuck on “Connecting to your garage”: route to local Rides when Android has no internet or the Convex startup query exceeds five seconds. Online bike setup and non-Android entry remain unchanged.
- [x] Build APK 1.3.7 (code 17) locally in WSL and verify package metadata/signature; certificate matches APK 1.3.6.
- [x] Install APK 1.3.7 over APK 1.3.6; Android reports version code 17 and the app process launches.
- [x] User confirms cold start in Airplane mode now reaches local Rides.
- [x] User confirms nationwide map rendering and both local searches on APK 1.3.7 in Airplane mode; map responsiveness and app stability failed.
- [x] Read Android process-exit history: it recorded native and Java crashes at 1.5–5.6 GB RSS. The active style referenced a 68.7 MB GeoJSON with roughly 365,000 named POIs, while the PMTiles contains a zoom-14 `pois` vector layer.
- [x] Change POI map labels to use the PMTiles vector layer and keep the nationwide FTS5 search database unchanged; leave only a tiny POI GeoJSON compatibility file for the current pack contract.
- [x] Create Philippines pack v1.0.1 (510,111,012 bytes); `pmtiles verify` and 263 manifest file checks pass.
- [x] Transfer v1.0.1 to Downloads and compare on-device SHA-256 for manifest, PMTiles, SQLite search, and POI asset with PC values.
- [ ] Import v1.0.1 and retest map responsiveness and crash behavior in Airplane mode. Keep v1.0.0 installed until the new pack passes.
- [ ] Verify on the Xiaomi that POI routes stay visible when recording starts and that stationary GPS drift no longer raises the average speed.
- [ ] On the Xiaomi, verify search scrolling/selection latency, off-route rerouting while online and its offline message, pan/zoom/recenter, notification metrics/actions, ride save, and map/stats on the Rides page.
- [ ] Record remaining limits: map/search are OSM coverage dependent; route guidance uses online OSRM car routing; Android OEM notification behavior is device-specific.

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| OSM has incomplete or stale business data | Some places will not appear, unlike Google/Grab | Include mapped POIs and addresses; keep online search, pin, and coordinate fallbacks; show data date and OSM attribution |
| Photon public demo has no service guarantee | Search can be temporarily unavailable | Debounce/cancel requests, keep local search working, and handle provider errors without blocking the recorder |
| Android OEM notification action behavior differs | Pause/end controls may be presented differently | Exercise the real Xiaomi notification shade and keep in-app controls available |
| Local route engine is not validated | Turn-by-turn cannot be offline | Keep OSRM clearly labeled online and retain the ferry/motorcycle limitations disclosure |
| GPS distance and speed are estimates | Buildings, poor satellite geometry, and 5-second sampling can change totals | Suppress accuracy-sized jitter, filter isolated speed spikes, and label recorded distance as a GPS estimate |

## Open questions

- None. The user authorized the Android-first offline implementation, requested the added navigation/notification flow, and the existing preference is to build locally in WSL.
