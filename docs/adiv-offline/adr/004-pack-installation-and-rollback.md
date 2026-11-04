# ADR 004: Folder-Based Offline Pack Installation

- **Status:** Accepted
- **Decision:** Import a pack from an Android system folder picker. Copy it into app-private storage, verify every file against the versioned manifest, validate the local Shortbread style and FTS5 database, then atomically update a small active-pack pointer. Keep older versions installed until the owner removes them.
- **Reason:** Philippine vector maps and routing/search data can be large. A folder avoids creating a second archive-sized temporary copy, and version directories make updates and rollback explicit.
- **Consequence:** The source folder must contain only manifest-listed files plus `manifest.json`. Installation needs enough temporary storage to preserve the active pack. The actual Android Storage Access Framework copy/move semantics and PMTiles URI need device verification before shipping generated assets.
