# ADV160 Maintenance Intervals — Source Verification

**Date:** 2026-11-01 · **Scope:** verification of `convex/seedData.ts` against reference material.

## Which source to follow?

Three references were provided. In order of authority:

1. **Owner's Manual scan (pp. 82–83)** — ✅ **authoritative.** This is the official Honda
   maintenance schedule for the bike. All interval values in the seed are now cited to it.
2. **"Honda ADV Maintenance Guide" infographic** — ⚠️ secondary/unofficial. Its own footer
   says it is "a general maintenance schedule" and to "refer to your Owner's Manual."
   It conflicts with the manual in several places (see conflicts below). Used **only**
   for items the manual does not list at all (Oil Filter, Rollers/Slide Piece, Fuel Injector).
3. **PH community/owner list (Facebook/Reddit)** — ⚠️ owner practice, not a schedule.
   Real-world tighter intervals (e.g., oil every 1,500 km). Useful as "severe usage"
   guidance, not as the baseline. Not cited in the seed.

**Rule of thumb:** follow the Owner's Manual for the baseline schedule; the infographic and
community values are personal-preference tightenings, not official intervals.

> Conflicts to be aware of (infographic vs. manual): engine oil R every 4,000 km/4 months
> (manual: every 6,000 km/12 months, initial 1,000 km) · coolant replace every 2 years
> (manual: 3 years) · spark plug replace every 8,000 km (manual cadence: 12,000 km).
> Community list conflicts: oil 1,500 km · spark plug 7,000 km · V-belt checks at 7k/10k/13k.

## Transcribed manual schedule (pp. 82–83)

Columns are ×1,000 km: 1 · 6 · 12 · 18 · 24 · 30 · 36, plus Annual Check and Regular
Replace. Legend: **I** inspect · **R** replace · **C** clean. Transcribed from the provided
scan; rows marked ⚠️ had ambiguous column alignment in the scan and should be verified
against the physical manual (values in the seed were kept conservative where flagged).

### Page 82 — engine/fuel/cooling

| Item | Marks (best read) | Resulting interval |
|---|---|---|
| Fuel Line | I @ 6·12·18·24·30·36 + Annual I | I every 6,000 km / 12 mo |
| Fuel Level | pre-ride I | pre-ride only |
| Throttle Operation | pre-ride I; I @ 12·18·24·30·36 + Annual I ⚠️ | I every 6,000 km / 12 mo |
| Air Cleaner | R @ 12·24 + Regular Replace R (fn² wet/dusty) | R every 12,000 km / 12 mo |
| Crankcase Breather | C @ 12·18·24·30·36 ⚠️ | kept at 12,000 km / 12 mo |
| Spark Plug | I/R alternating from 12 (R cadence 12,000 km) ⚠️ | R every 12,000 km / 12 mo |
| Valve Clearance | I @ 12·18·24·30·36 ⚠️ | kept at 12,000 km / 12 mo |
| Engine Oil | R @ 1 (initial) then R @ 6·12·18·24·30·36 + Annual + Regular R | R every 6,000 km / 12 mo; first at 1,000 km |
| Oil Strainer Screen | C @ 12·24·36 | C every 12,000 km / 12 mo |
| Engine Idle Speed | I @ 6·12·18·24·30·36 ⚠️ | I every 6,000 km / 12 mo |
| Radiator Coolant | I @ 12·24·36 + Regular Replace **3 Years** | replace every 3 yr |
| Cooling System | I @ 12·24·36 + Annual I | I every 12,000 km / 12 mo ← **seed changed 6,000 → 12,000** |

### Page 83 — drivetrain/chassis/brakes

| Item | Marks (best read) | Resulting interval |
|---|---|---|
| Drive Belt | I @ 12·36, R @ 24 | I every 12,000 km; R ~24,000 km |
| Final Drive Oil | I @ 12, R @ 24 + Regular Replace **2 Years** | replace every 2 yr |
| Battery | I @ 12·18·24·30·36 + Annual I ⚠️ | I every 6,000 km / 12 mo |
| Brake Fluid | I @ 12·18·24·30·36 + Annual I + Regular Replace **2 Years** | **new item**: replace every 24 mo |
| Brake Pads Wear | I @ 6·12·18·24·30·36 + Annual I | covered by "Brake System" |
| Brake System | I @ 6·12·18·24·30·36 + Annual I | I every 6,000 km / 12 mo |
| Headlight Aim | I @ 12·24·36 + Annual I | folded into "Lights, Signals & Horn" notes |
| Lights/Horn | I @ 12·24·36 + Annual I | I every 12,000 km / 12 mo ← **seed changed 6,000 → 12,000** |
| Clutch Shoes Wear | I @ 12·24·36 | I every 12,000 km / 12 mo |
| Side Stand | I @ 12·18·24·30·36 + Annual I ⚠️ | I every 6,000 km / 12 mo |
| Suspension | I @ 12·24·36 + Annual I | I every 12,000 km / 12 mo |
| Nuts, Bolts, Fasteners | I @ 6·12·18·24·30·36 ⚠️ | kept at 12,000 km / 12 mo |
| Wheels/Tyres | pre-ride I + periodic I (ref. p.90) | pre-ride model: 1,000 km / 1 mo |
| Steering Head Bearings | I @ 12·24·36 + Annual I | I every 12,000 km / 12 mo ← **seed changed 24,000 → 12,000** |

## Changes applied to `convex/seedData.ts`

| Item | Before | After | Why |
|---|---|---|---|
| Steering Head Bearings | 24,000 km / 24 mo | **12,000 km / 12 mo** | manual p.83: I @ 12·24·36 |
| Lights, Signals & Horn | 6,000 km / 12 mo | **12,000 km / 12 mo** | manual p.83: I @ 12·24·36 |
| Cooling System | 6,000 km / 12 mo | **12,000 km / 12 mo** | manual p.82: I @ 12·24·36 |
| **Brake Fluid** | — (only a note on "Brake System") | **new item**, 24 mo, dealer | manual p.83: Regular Replace 2 Years |
| Engine Oil | description | + "Initial change at 1,000 km" | manual p.82: R @ 1 |
| Drive Belt | description/notes | replacement at ~24,000 km (was "every 12,000 km") | manual p.83: R @ 24 |
| All 26 items | no citation | `intervalSource` populated | provenance |

## ⚠️ Verify against your physical manual

Column alignment in the scan was ambiguous for: **Valve Clearance, Crankcase Breather,
Nuts & Bolts, Battery, Side Stand, Throttle Operation, Engine Idle Speed, Spark Plug
(R columns)**. The seed keeps conservative values for these; each item's `intervalSource`
notes where to double-check. If your printed manual differs, edit the item interval in
the app (Maintenance Center → edit item) — no code change needed.

## Notes for existing installs

Seeding is **idempotent**: it only inserts when no items exist, so an existing dev/prod
database keeps its old values. Options to pick up the corrected schedule:

- Edit intervals via the Maintenance Center UI (safe, per-item), **or**
- Re-run the seed mutation with `force: true` (⚠️ known hazard: it deletes items without
  checking for maintenance logs, which would orphan log history — only do this on an
  empty/test deployment or before logging anything).
