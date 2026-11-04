# ADR 003: Offline Map and Routing Feasibility Gate

- **Status:** Accepted
- **Decision:** Use local PMTiles through the existing MapLibre RN integration if the exact Android wrapper path passes airplane-mode tests. Use a native on-device routing engine only after the Valhalla Mobile bridge and graph format pass a real-device route test.
- **Reason:** Native support in an underlying library does not prove the Expo/React Native wrapper or packaged graph works on target hardware.
- **Consequence:** Keep CARTO and OSRM as explicitly online paths. If the local proof fails, use a legal local MapLibre offline pack for map rendering; defer offline route guidance unless a native embedded alternative passes the same gate. Never label HTTP routing as offline.
- **Current status:** No Android device was attached during implementation. Local PMTiles, including the documented generated-pack fallback, has not been tried on hardware. OSRM remains the online-only guidance provider; the typed routing contract returns no native implementation.
