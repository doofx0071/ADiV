# ADiV Mapbox Android feasibility implementation

Status: implemented as an opt-in Android spike; not approved for use under a $0 account and not device-validated.

## Included

- Added an Android Expo module that creates one app-private Mapbox `TileStore`, passes it to Maps and Navigation, loads a Davao test style pack and map/routing tile region, reports separate readiness and version metadata, estimates tile-region storage on explicit request, and removes/cancels regions.
- Added a Mapbox map adapter and native Navigation route/guidance bridge. Offline-only route requests disable Mapbox network access and reject results unless the SDK reports an offline route origin. The current routing profile is `driving`, not motorcycle-specific.
- Kept MapLibre, OSRM, and imported OSM map/search packs as the fallback path.
- Kept Expo location recording as the saved GPS source of truth. Mapbox guidance is entered only from Navigate + Record; Record Only does not create a navigation session.
- Added an explicit opt-in gate. `EXPO_PUBLIC_MAPBOX_EXPERIMENTAL_ENABLED` defaults to `false`; an Android public `pk.` token is also required. No access token is included here.

## License and account gate

The current [Mapbox Terms of Service](https://www.mapbox.com/legal/tos) say vehicle-related apps require a separate development license for non-production use and a separate commercial license for production use. ADiV is a motorcycle navigation app. Free-tier MAU or trip allowances do not establish that the vehicle-use license is free or waived.

Do not enable the experiment, configure a token, estimate/download tiles, or use Mapbox guidance under the assumption that this is free. The opt-in flag is a deliberate runtime gate; it is not license confirmation. Mapbox must confirm the applicable license and cost for this personal, unpublished Android app.

## Verification and gaps

- Mobile TypeScript typecheck passed on 2026-11-03.
- Expo Android prebuild passed in an isolated temporary copy, and Expo Autolinking found the local bridge module.
- Gradle `assembleDebug` could not run because this machine has no JDK (`JAVA_HOME` is unset and `java` is absent); native compilation is therefore unverified.
- No Mapbox token was configured, no Mapbox SDK/API account-usage requests or tile downloads were made, and no physical-device test was run.
- Offline route/reroute, shared TileStore behavior in the generated app, release build, airplane-mode cold launch, voice, battery/background lifecycle, actual storage size, Philippines coverage, and cost remain unverified.
- The estimator covers map and Navigation tile-region storage; the style pack is separate, and estimates can differ from measured download size.

## Required next proof

1. Get written Mapbox confirmation of development-license requirements and total cost for this app. If no-cost use is not approved, leave the experiment disabled and keep the current providers.
2. Build a clean Android app with the opt-in flag and a public `pk.` token only after that confirmation.
3. On a physical Android device, install the Davao test region, force-stop/reboot, enable airplane mode, request a previously uncached route, deviate, and verify a local reroute with no online fallback.
4. Measure useful coverage, storage, tile-pack count, and actual account usage before considering wider coverage or provider removal.

Mapbox implementation follows the official [Android offline navigation guide](https://docs.mapbox.com/android/navigation/guides/advanced/offline/) and [TileStore estimate API](https://docs.mapbox.com/android/maps/api/latest/mapbox-maps-android/com.mapbox.common/-tile-store/estimate-tile-region.html).
