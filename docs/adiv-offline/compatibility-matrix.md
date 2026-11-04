# Offline Upgrade Compatibility Matrix

| Area | Checked baseline | Gate / status |
|---|---|---|
| Expo / React Native | Expo 58.0.22, RN 0.88.1, New Architecture | SDK-compatible installs; verify with Expo doctor and a development build |
| MapLibre RN | `@maplibre/maplibre-react-native` 11.5.1; native Android 13.6.1 | Native PMTiles floor is met by the locked Android artifact; wrapper URI/style behavior still requires device proof |
| Local storage | `expo-sqlite` absent at baseline; SDK 58 recommends `~58.0.15` | SQLite active rides, GPS points, outbox, and local history implemented; migrations and Android process-death persistence still require native validation |
| Package import | Expo FileSystem 58.0.13 | Android `Directory.pickDirectoryAsync`, native file copies, and SHA-256 verification are implemented; Storage Access Framework copy behavior still requires device validation |
| Background GPS | Expo Location 58.0.20 + TaskManager 58.0.13 | Existing Android foreground-service flow; verify durable writes under screen lock and restart |
| Offline routing | No native bridge or graph | Valhalla Mobile Android library 0.6.1 candidate; build and physical route proof required |
| Offline search | No FTS index | SQLite FTS5 enabled by Expo SQLite configuration; query and package validation code exists, but no generated PH index or device install is proven |
| Device | No Android device attached to the implementation session | Hardware acceptance remains outstanding; Android-only initial scope |
| Backend | Convex 1.48.0, no auth, single bike | Optional client ride idempotency implemented; new GPS geometry stays local |

## Current implementation evidence

- Static app typecheck and root unit tests are the code-level gate. A passing local check does not prove native rendering, SAF access, SQLite durability, or background GPS on Android.
- MapLibre Android upstream documents local PMTiles URIs as `pmtiles://file://...` from Android 11.7.0 onward; the locked native dependency is newer than that. The React Native wrapper and current app path still need a physical cold-restart/airplane-mode test.
- The selected Valhalla Mobile candidate has no Expo bridge in this repository. Offline routing remains explicitly deferred until a typed native implementation and real-device graph test pass.
