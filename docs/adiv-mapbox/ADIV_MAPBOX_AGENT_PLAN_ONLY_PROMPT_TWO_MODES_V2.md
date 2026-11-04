# ADiV — Lead Agent /plan Prompt: Mapbox Migration + Transparent Activity Sharing (Two Riding Modes)

> **Usage:** Paste everything under **Agent prompt** into a new session for your lead AI coding agent. Attach or make available `ADIV_MAPBOX_MIGRATION_REVISION_PLAN_TWO_MODES_V2.md` (this revision), plus the previous `ADIV_OFFLINE_MAPS_NAVIGATION_MASTER_PLAN.md` and `ADIV_AGENT_KICKOFF_PROMPT.md`. This is a **PLAN-ONLY** request. Do **not** start implementation until the user explicitly approves the revised migration plan. **Version v2.1 adds three sharing templates to the same two riding modes.**

---

## Agent prompt

You are the **Lead Engineering Architect, Migration Planner, and Engineering Orchestrator** for **ADiV**, an **existing** Expo / React Native / TypeScript mobile motorcycle application with **Convex** and an offline-first implementation.

### Context you must not lose

A prior agent already received and reportedly **implemented** the earlier specifications:

- `ADIV_OFFLINE_MAPS_NAVIGATION_MASTER_PLAN.md`
- `ADIV_AGENT_KICKOFF_PROMPT.md`

Those specs described Philippine-wide MapLibre + OpenStreetMap/Geofabrik + PMTiles maps, on-device Valhalla navigation, offline destination search, Expo/SQLite-based GPS ride recording, a durable SQLite–Convex sync outbox, downloadable regional/nationwide packs, and route/snapshot/GPX sharing. **Do not restart the project from the old prompts.** Your first job is to audit the current repository and determine what was actually implemented, partially implemented, tested, or not implemented. The older docs describe the intended baseline; the **codebase is the source of truth for current implementation**.

I now want to **revise the existing implementation to use Mapbox Maps and Mapbox Navigation SDK** where feasible, simplifying the mapping/navigation stack while retaining genuinely functional offline features. **Product-scope revision:** Remove the standalone **Navigate Only** riding mode from the target design. ADiV must offer **exactly two modes: Record Only and Navigate + Record**. I can use the separate Google Maps app for guidance without ADiV's Mapbox navigation, so extra dedicated Navigate Only screens and UI pathways are unnecessary.

You must read `ADIV_MAPBOX_MIGRATION_REVISION_PLAN_TWO_MODES_V2.md` in full. It is the target design and validation checklist for this **revision**, not a mandate to blindly replace working code.

### Working mode — `/plan` only

**Do planning/auditing now, not implementation.**

- No dependency installation, source-code changes, schema migrations, removal of MapLibre/Valhalla, creation of new native build variants, token provisioning, or network-intensive map downloads.
- You may read files, inspect package metadata, run safe read-only repository diagnostics, and run existing baseline tests/typecheck/lint if they do not mutate project files or break concurrent development.
- You may prepare planning Markdown documentation in the existing docs folder if this is permitted by the environment. Otherwise return the complete plan in your response for approval.
- **Do not `git reset`, clean, force-push, rewrite branches, delete caches/maps, or modify existing user data.** Do not overwrite work from other agents.
- Identify uncertain implementation claims and mark them `UNVERIFIED` rather than inferring them from old documentation.
- If a native feature requires a proof-of-concept, **design the precise spike and acceptance gate now; execute only after user approval**.
- Finish with an implementation-ready, evidence-based plan and a clear GO / NO-GO recommendation. STOP; do not proceed to coding automatically.

### Primary objective

Design a safe incremental provider migration:

**Current (verify actual state):**
- MapLibre React Native map renderer
- OSM/Geofabrik offline PH map packs, styles and PMTiles
- Valhalla Mobile/Expo native routing and PH routing graphs
- Existing SQLite offline place search
- Expo Location/TaskManager background ride tracking
- Existing SQLite ride data/outbox + Convex sync
- Existing maintenance, fuel, rides, overlays, route history and GPX/image sharing

**Target (pending compatibility proof):**
- `@rnmapbox/maps` for rendering and native offline map style/tile regions
- Mapbox Navigation SDK v3, accessed through `@rnmapbox/navigation` if compatible, with minimal native bridging as required
- Mapbox native `TileStore` routing tiles and **genuine on-device offline routing and rerouting**
- Existing SQLite local search (do not add premium Mapbox Offline Search)
- Existing GPS recorder, SQLite/Convex, data model, UI, ride exports and features
- **Exactly two riding modes: Record Only and Navigate + Record. No standalone Navigate Only mode, screen, CTA, route-launch option, or setting.**
- **Exactly three post-ride sharing templates available from either mode: Route Only, Statistics Only, and Route + Statistics, as transparent PNGs, with optional photo/map background and existing GPX. These are not additional riding modes.**

**Critical rule:** A downloaded offline map does **not** prove offline navigation. Require evidence of both *map/style assets* and *Mapbox native routing tiles* installed and operational after an airplane-mode cold restart.

### Mandatory product behavior — exactly two selectable riding modes

1. **Mode A — Record Only:** record actual motorcycle GPS movement locally with no connection, no Mapbox Active Guidance, no Mapbox Free Drive and no mandatory map rendering. Preserve pause/resume, moving time vs stopped time, distance, speed, background behavior, crash recovery and local sync queue. Do not ask for a destination. Even if the rider views an optional Mapbox map, map MAU billing remains distinct from navigation-trip usage.
2. **Mode B — Navigate + Record:** route search/pin/favorites, preview, ETA, route line, voice maneuvers, route progress, offline routing/rerouting and arrival are **only accessible inside this mode**. Start one verified native Mapbox Active Guidance session **and** one durable local ride recording. The actual GPS trail and stats must be independently saved. If recording cannot start, do not silently fall back to an undocumented Navigate Only mode. If Record Only is already active, attach guidance to the existing ride ID without duplicating rides/points. End guidance billing promptly on arrival/stop while the ride can continue as Record Only until Finish Ride; returning home may start an additional leg in the same recorded ride.
3. **External Google Maps option (not a third ADiV mode):** user may start ADiV Record Only, switch to the official Google Maps app to navigate, and leave ADiV recording in background as permitted by the OS. Validate this with real device tests (Android first), phone lock, battery optimization and app switching. Do not add Google Maps APIs, SDK integration or a Google Maps navigation mode. This workflow should not start any Mapbox navigation session; rendering Mapbox maps can still create a Maps MAU.
4. **No Navigate Only:** audit existing screens, CTA buttons, settings, state machines, test names, onboarding, documentation and launch paths. Plan to remove/redirect standalone Navigate Only **from UI and product entry points**, while retaining the internal navigation engine used by Mode B. All mode selectors show exactly two choices. Do not delete working underlying navigation functionality prematurely.
5. **Independent recording:** during Mode B share one verified GPS source if practical; otherwise deduplicate accurate raw samples and maintain a reliable recorder when navigation stops/unmounts. Pause recording independently, distinguish planned route from actual traveled route, and ensure rerouting never overwrites historical GPS points.
6. **Offline coverage:** preserve original **whole-Philippines offline goal** as an explicit acceptance requirement, not something that disappears silently. Evaluate Mapbox's 750 unique map tile-pack cap, map zoom/detail, routing region size, storage and legal terms. First prioritize Davao City and Davao→Tagum, Davao→Digos, Davao→Mati test corridors; then Mindanao, and only promise nationwide once measured. If full-PH parity is impossible under Mapbox's current constraints, present options (legacy offline asset fallback / regional-only change / postpone migration), with pros/cons and an explicit user decision point.
7. **Offline navigation proof:** a Mapbox map download alone does not prove offline routing. For Mode B, verify offline map style/tile coverage, routing tiles, a *new* on-device route and actual local rerouting after airplane-mode cold restart. Do not promise live traffic or live incidents offline.
8. **Offline search:** keep existing local SQLite/FTS5 (if present), favorites, map pin and coordinate input. Mapbox Offline Search is **premium** on Android; do not introduce it or assume it is free.
9. **Existing business data:** Keep Convex; no Turso migration. Preserve SQLite rides, ride_points, sync outbox, offline maintenance and expenses. No destructive schema change; no duplication or data loss after retries or account switching.
10. **Export:** preserve existing GPX, route-photo overlays, compatible map snapshots and share UI. **Both Mode A and Mode B must expose the same post-ride Share Activity UI and exactly three transparent PNG templates: Route Only, Statistics Only, and Route + Statistics (recommended default).** Use actual committed GPS points and canonical motorcycle metrics, never the planned navigation polyline or running pace. Include privacy masking, Story/Square dimensions, offline export, gallery save and OS sharing; treat direct Instagram Story integration as conditional on device/platform proof.
11. **UX and usage:** preserve ADiV design system/screens. Do not start a Mapbox navigation session in Mode A, including when switching to external Google Maps. Do not leave a stale Mode B session active after guidance ends. Removing standalone Navigate Only does **not** itself reduce the bill for Mode B legs; savings happen when guidance is not started. Maintain clear offline readiness, high-contrast motorcycle guidance, and low battery impact.

### New required feature: transparent Strava-style **functionality**, ADiV-original design

The user provided a screenshot of a **transparent statistics card with a checkerboard editor preview**. The screenshot itself does not show a GPS line. Implement **a plan** for the three ADiV-branded options below; do **not** copy Strava trademarks, icons, precise styling or logos:

| Post-ride template (not a mode) | Expected content | Offline output |
|---|---|---|
| **Route Only** | Actual GPS polyline, optional start/end dots; no map background | True-alpha PNG |
| **Statistics Only** | Distance, moving/elapsed duration, average speed, optional max speed/date; motorcycle units (km/km/h) | True-alpha PNG |
| **Route + Statistics** | Actual GPS polyline and motorcycle statistics, readable composition | True-alpha PNG; default selection |

Plan a **single reusable pipeline**: committed SQLite `rides`/`ride_points` and canonical stats → validate/sort/filter points → preserve real detours → fit route within canvas without stretching → SVG/vector + stat labels → **true RGBA PNG** → Save to Photos/Gallery or OS Share Sheet. Saved ride history must allow re-export after app restart. Story size **1080×1920** and square size **1080×1080** are required; high-resolution optional after physical-device memory testing. Existing `react-native-svg`, `react-native-view-shot`, `expo-sharing` etc. should be reused **if the repository already has proven integrations**; do not add duplicate dependencies just for a mockup. Verify view capture transparency; if native Mapbox snapshots render opaque/black, create transparent route/stat images independently of the native map. Optionally composite an overlay onto an on-device user photo; this is an **export background option**, not another template or mode. Any Mapbox map-background image is optional, separately verified offline, and must respect provider attribution/license conditions.

- Preview can show a checkerboard; **the exported PNG must not**. Test alpha channel by inspecting rendered pixels, and composite outputs on white and dark images. Test aspect-ratio preservation, typography, route legibility, and safe handling of zero/one-point, noisy, or very long tracks.
- Show accurate **motorcycle** metrics, not running pace (`min/km`). Use recorded actual route points even when Mapbox guidance rerouted; preserve original ride and its GPX/Convex data unchanged.
- Offer simple route color/thickness, text contrast, scale/position and optional metric selection. Prefer the existing ADiV look and avoid unnecessary editing dependencies.
- Include privacy controls masking a configurable distance near the ride start/finish **in exported route geometry and visible markers**, without altering private SQLite history; warn users about location in photo EXIF. If exporting GPX with privacy mode, make the privacy-masked file explicit rather than claiming the ordinary GPX is masked.
- Offline export must work from a previously saved ride after airplane-mode cold launch and must **not** start Mapbox Active Guidance, Free Drive, Directions, Search, Convex requests, or a map snapshot just to create a transparent overlay. Only explicitly requested optional map-background exports may use Mapbox map rendering, with any Maps MAU usage acknowledged.
- Save to Gallery and OS-native sharing are required targets; create a **Story-compatible PNG** for Instagram. Verify platform-specific deep link/Instagram Stories publishing only if supported; otherwise use the system share sheet or manual Save/Open fallback. Never invent an automatically generated public activity link.
- Tell the user which part of existing share/GPX functionality is currently implemented versus missing. **No source changes during `/plan`.** In the future implementation phase, require pixel-level alpha checks, end-to-end physical device share flow, permission denial handling, low storage/error cleanup and zero extra navigation session tests.

### Critical technical research and verification

Check original/current Mapbox documentation, not generic blog claims:

- https://rnmapbox.github.io/docs/navigation/overview
- https://rnmapbox.github.io/docs/navigation/install
- https://docs.mapbox.com/android/navigation/guides/advanced/offline/
- https://docs.mapbox.com/ios/navigation/guides/advanced/offline/
- https://docs.mapbox.com/android/maps/guides/offline/manage-offline-data/
- https://docs.mapbox.com/android/search/guides/search-engine/offline/
- https://docs.mapbox.com/android/navigation/guides/pricing/
- https://www.mapbox.com/pricing

At the time this prompt was authored (2026-11-03), the community `@rnmapbox/navigation` docs described **0.1.0** as pre-1.0, React Native >=0.79 New Architecture, `@rnmapbox/maps >=10.3.16 <10.4.0`, Navigation SDK 3.33.0 and Maps SDK 11.33.0, and called out limited real-device/release testing. The wrapper **does not expose an explicit offline routing API**, even though Mapbox native Navigation SDK supports offline regions/TileStore and rerouting. Confirm current version compatibility and audit the app's actual Expo SDK/RN/Gradle/Kotlin/iOS targets. Do not copy-paste version pins without checking the repository.

**Specifically answer all of these in the plan:**

1. What map/navigation/offline/ride/Convex code exists today, with exact paths and objective implementation evidence?
2. Can `@rnmapbox/maps` and `@rnmapbox/navigation` be built with the repo's actual Expo SDK, React Native New Architecture, Android min/compile SDK and (if targeted) iOS configuration?
3. Can we share one compatible native `TileStore` across maps and navigation; what exact JNI/Kotlin/Swift/Expo bridge interfaces are required, if any?
4. How will we install/map-check both a style pack + map tile region AND the navigation routing tiles with correct version/profile?
5. How will we prove **new offline route calculation** and **rerouting** in airplane mode after restarting the app, not merely following a route cached earlier while online?
6. Can existing local SQLite place search remain independent of Mapbox tiles, attribution and premium services?
7. How do we handle `Record Only` without triggering a Mapbox `startTripSession` or Free Drive trip?
8. During `Navigate + Record`, what is the GPS source of truth (raw vs enhanced/map-matched coordinates), and how do we avoid double subscriptions, duplicate samples and losing track when guidance finishes/unmounts? How does `Record Only` remain active when Google Maps is the foreground app?
9. Which components/services can be reused without modification, and which files must be changed, replaced, isolated or ultimately removed?
10. Will existing exported map snapshots/route overlays still work with native Mapbox map views? What fallback is needed?
11. What is the *measured or testable* route to downloadable Mindanao and PH nationwide coverage under 750 unique tile packs and device storage limits? What is the exact fallback if not possible?
12. How does billing work for Navigation MAUs, Active Guidance legs, Free Drive hourly trips, map MAUs, route preview outside sessions and separate Search requests? How will we detect runaway usage without logging private GPS?
13. What Mapbox account/access token setup is required? How are `pk.*` and `sk.*` tokens treated? What Android/iOS package/app restriction settings and legal attributions are necessary?
14. How can users revert to the current functional provider if the Mapbox release does not pass offline/device tests, without breaking local data?
15. Which tests must run on an actual Android phone and which require iOS testing? What can be unit-tested with deterministic GPS replay data?
16. Which existing UI/navigation-only entry points and mode options must be removed, hidden, repurposed or redirected (without deleting the Mode B engine), and how will you prove only two modes remain?
17. Which existing source files/components already implement transparent image sharing, GPX and ride statistics; are they actually wired to both riding modes and Ride History? Give exact file paths and evidence.
18. How will the three share templates export true-alpha PNG (not a checkerboard/opaque map), preserve route proportions and show recorded detours? Show the render contract, image dimensions, pixel-alpha tests, photo composition fallback and choice of existing dependencies.
19. How will shared ride statistics remain accurate for a motorcycle, including stopped vs moving time, GPS-average speed, and zero/one-point or noisy rides? What privacy masking and GPX export behavior must be maintained?
20. How will offline saved-ride export, gallery save, OS sharing, Instagram Story-compatible media and platform fallbacks be verified without any new Mapbox navigation trip or API request?

### Plan structure to deliver

Return an **implementation-ready engineering migration plan**, not generic advice, using these sections:

**A. Executive summary and recommendation** — what to migrate now, what not to, why, risks and explicit NO-GO conditions.

**B. Real repository audit** — show versions, paths, existing feature matrix (`implemented`, `partial`, `missing`, `unverified`), local DB/Convex schemas, current native modules, tests and latest available baseline results. Use only actual evidence.

**C. Change impact / delta matrix** — `Existing component | Keep/Adapt/Replace/Remove later | New provider | Actual files | Migration risk | Test proof`.

**D. Target architecture** — diagram and data/control flow: map, navigation, offline manager, location coordinator, SQLite recorder, search, outbox and Convex. Model **exactly two selectable modes**. The navigation engine is used only within Navigate + Record; Record Only can continue while external Google Maps runs.

**E. Native compatibility and offline proof design** — exact dependency/Expo compatibility, TileStore and navigation tiles integration approach, bridge contract/event lifecycle, testing method and failover if wrapper is insufficient. Explain why offline map files alone are insufficient.

**F. Philippines offline packaging plan** — route corridor vs region vs nationwide, downloads, region manifests, zoom/storage, tile-pack limits, expiration/versioning, update safety, data attribution, offline readiness and missing coverage UX.

**G. Two-mode recording/navigation state machines** — Record Only independent recorder; Navigate + Record combined lifecycle. Include events, start/pause/resume/finish/arrival, intermediate stops, app restart, crash, Google Maps foreground switch, background, battery saver, location accuracy, dedupe, GPS raw/enhanced semantics and actual GPS trail. Show the removal of all standalone Navigate Only UI entry points.

**H. Activity Share / transparent PNG export plan** — three templates usable from either mode and Ride History; actual GPS trail and motorcycle metrics; Story/Square layout; preview vs alpha in saved output; photo/map backgrounds as separate options; share-only masking; GPX preservation; Save/Gallery/OS Share and Instagram fallback; platform tests and zero-trip/no-network acceptance.

**I. API usage, budget and privacy** — Mapbox plan and free-tier verification, cost categories, accidental trip prevention, alerts, secrets/public token handling, offline search premium restriction, GDPR/PH Data Privacy Act considerations where relevant, GPX/privacy.

**J. Phased implementation roadmap** — P0 audit, P1 compatibility decision, P2 native spikes, P3 integration, P4 offline region manager, P5 QA/cost, P6 safe cleanup. Each phase includes exact deliverables, dependencies, acceptance/stop/go gate, owner and rollback.

**K. Detailed testing matrix** — verify exactly two mode choices; no standalone Navigate Only CTA; Record Only no Mapbox trip; Record Only with external Google Maps foreground; device-based tests in Davao; airplane-mode cold start; new offline route and deviation inside Navigate + Record; multi-leg Navigate + Record; background and crash recovery; zero duplicate cloud sync; map download/storage failures; no unexpected Mapbox sessions; **all three transparent exports from both modes, Story/Square sizing, alpha/checkerboard checks, saved rides/airplane mode, privacy masking and Gallery/Instagram fallbacks**; iOS separately.

**L. Git/worktree/agent assignments** — realistic minimal team, nonoverlapping file ownership, PR order, one integration/Git owner, no uncontrolled changes. Avoid making more agents than useful.

**M. Open decisions and approval requests** — give clear default recommendations, list genuine blockers/unknowns, and explicitly say what must be approved before implementing.

If documentation files are used, follow the real repository's style; suggested destination `docs/adiv-mapbox/MIGRATION_PLAN.md` with ADRs and companion QA files only when they add value. Do not create empty placeholder documents.

### Safety, privacy and correctness rules

- Treat vehicle guidance as safety-critical. No unsupported motorcycle-specific legality claims; review highway, toll, one-way, ferry, bridge and motorcycle-access rules in Philippine fixtures. No lane/traffic/speed-limit features unless coverage was verified.
- Never claim offline navigation works solely because offline map renders or an online route remains visible with internet disconnected.
- Never claim background GPS continues after a user force-stop or OS restrictions where not supported.
- Never send GPS samples, secrets, or personally identifying route coordinates to logs, analytics or screenshots by default.
- Never copy/prebundle Mapbox proprietary offline map content outside license permissions; don't convert Mapbox tiles into distributable PMTiles. Retained OSM-derived search/map data must retain appropriate ODbL attribution and provenance.
- Do not silently downgrade nationwide offline scope to region-only. If impossible, STOP and seek user decision with measured evidence.
- Do not install Mapbox premium Offline Search or any paid add-on without explicit approval.
- Prefer fewer dependencies, but not at the cost of removing working local recording/offline sync or violating licensing.
- The final product **must not** include a separate Navigate Only riding mode. Navigation functionality remains in the code **only to support Navigate + Record**. Do not interpret this as a request to remove offline turn-by-turn navigation.
- External Google Maps is an independent third-party app, **not** a third ADiV mode. Do not integrate Google Maps APIs unless separately approved.
- Distinguish **Mapbox Maps SDK MAUs**, **Mapbox Navigation trips/MAUs** and separately billed APIs. Never claim eliminating a UI mode automatically halves usage.
- **Share templates are not modes**: exactly two riding modes and exactly three post-ride PNG templates. Transparent exports must work without Mapbox SDK route calculation and must never reveal the user's private start/finish locations without clear privacy choices. Do not reproduce Strava artwork or branding.

### Required end-of-response format

1. **Audit findings:** objective evidence, exact file paths, real versions and unverified items.
2. **Recommended architecture:** exact two-mode mapping and navigation migration with preserved offline recording/search/sync and external Google Maps recording scenario; include **three-template shared Activity Share pipeline** that operates on saved actual GPS points.
3. **Migration phase table:** workstreams, risk, dependencies, acceptance gates and rollback.
4. **Offline parity truth table:** online map, downloaded map, online guidance, offline new route, offline reroute, search, voice and ride recording; include current vs proposed and missing proof.
5. **Test/compatibility matrix:** exact commands/tests already run and safe future spikes, with evidence status; include **both-mode Story/Square transparent PNG alpha verification, offline export, actual-track correctness, privacy masking and share target fallback**.
6. **Budget/terms report:** Mapbox free tiers, potential charges, tile-pack cap, relevant licenses and caveats.
7. **Open issues + GO/NO-GO recommendation.**
8. **Next action:** state clearly **`PLAN COMPLETE — AWAITING IMPLEMENTATION APPROVAL`**.

**BEGIN NOW with the real codebase audit. Remain in planning mode. No implementation until approved.**
