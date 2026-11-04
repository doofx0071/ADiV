# ADR 001: Android-First CNG Integration

- **Status:** Accepted
- **Decision:** Implement offline capability for the existing Expo Android app using CNG and Expo local modules. Keep web behavior and existing online flows. Do not claim iOS offline support without a separate native build and device test.
- **Reason:** The documented mobile product is Android-first, the repository has no checked-in native projects, and the high-risk map/routing integrations require a native development build.
- **Consequence:** Native dependencies and permission changes belong in `mobile/package.json` and `mobile/app.json`; do not hand-edit generated native projects. Offline UI remains unavailable until the Android proofs pass.
