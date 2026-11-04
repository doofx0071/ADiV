# ADR 002: Keep New GPS Geometry On Device

- **Status:** Accepted
- **Decision:** Store full GPS samples and encoded route geometry in the app's private local database. Upload ride totals and non-location metadata only. Preserve the existing Convex `route` field for legacy rows, but omit it from new saves.
- **Reason:** ADiV has no sign-in or user-scoped backend, and the approved data boundary keeps route history local.
- **Consequence:** Local track history, GPX and share cards depend on the device database. Web history can show synced ride summaries but will not receive new route geometry.
