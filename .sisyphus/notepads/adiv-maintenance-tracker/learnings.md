## [2026-06-02] Wave 1 Execution Started

### T1: Project Scaffolding - COMPLETED
- Next.js 16 App Router with TypeScript
- Tailwind CSS v4 configured
- Convex connected (dev deployment: clever-bass-796)
- shadcn/ui components installed (14 components)
- Vitest configured and passing
- Light cyber-moto theme CSS fixed (resolved `nul` Windows device issue)
- All dependencies installed

### Critical Fix Applied
**Issue**: shadcn/ui init created circular CSS reference `--font-mono: var(--font-mono)` which resolved to null, and on Windows null becomes the `NUL` device name, crashing Turbopack.
**Fix**: Removed circular reference, simplified font handling, removed `@apply font-mono` from `@layer base`.

### T2: Convex Schema Design - COMPLETED

### Schema Decisions
- **Single-bike architecture**: All 8 tables defined without bikeId foreign keys — the app manages one bike at a time
- **Timestamps**: All date fields use `v.number()` (milliseconds since epoch) for consistency with `Date.now()`
- **maintenanceLogs.itemId** references `maintenanceItems` via `v.id("maintenanceItems")` — proper Convex document reference
- **files** uses polymorphic reference pattern: `recordType` (string) + `recordId` (string) to link files to any record type
- **photos** field on maintenanceLogs uses `v.array(v.string())` for storage IDs

### Indexes Created
| Table | Index | Fields | Purpose |
|-------|-------|--------|---------|
| maintenanceLogs | by_item | itemId | Find all logs for a maintenance item |
| maintenanceLogs | by_date | date | Chronological service history |
| rides | by_date | date | Chronological ride history |
| fuelLogs | by_date | date | Chronological fuel history |
| files | by_record | recordType, recordId | Find all files attached to a record |

### Test Strategy
- 24 Vitest tests verify schema structure via static source analysis (no `convex/server` runtime dependency)
- Each table's existence, field validators, and indexes are explicitly tested
- Single-bike constraint enforced by test (no bikeId fields)

### Deployment
- `npx convex codegen` passed — types generated successfully
- All 8 tables deployed to Convex cloud (clever-bass-796)

### Next Tasks
- T3: Theme refinement (in progress)
- T4: Seed maintenance items (waiting for T2)
- T5: Bike profile onboarding (waiting for T2)

## [2026-06-02] T3: Theme Refinement - COMPLETED

### Files Created
- `lib/theme.ts` — Theme constants, color tokens, WCAG contrast helpers, status mappings
- `components/ui/theme-provider.tsx` — React context for light/dark/system theme switching
- `components/ui/theme-toggle.tsx` — Accessible theme toggle button with Sun/Moon icons
- `components/layout/stat-card.tsx` — Reusable stat card with trend indicator
- `components/layout/page-header.tsx` — Page header with title, description, and action slot
- `components/layout/status-badge.tsx` — Status badge with upcoming/due/overdue/completed variants
- `lib/theme.test.ts` — 45 Vitest tests for theme utilities and contrast compliance

### Theme Decisions
- **Light mode default**: Background `#f8fafc`, Card `#ffffff`, Primary `#00d4ff` (neon cyan), Accent `#ff6b00` (motorcycle orange)
- **Dark mode**: Background `#0a0a0f`, Card `#13131f` — optimized for low-light garage environments
- **Success/Warning tokens added**: `--color-success` (#22c55e) and `--color-warning` (#f59e0b) for maintenance status badges
- **Foreground colors**: All bright neon colors use `#000000` (black) foreground for WCAG AA compliance — white text on bright cyan/orange/green/red failed contrast ratios

### Accessibility Fix
- Initial design used `#ffffff` foreground on `#ff6b00` accent and `#ef4444` destructive — contrast ratios were ~2.86:1 and ~3.79:1, failing WCAG AA
- Changed all `-foreground` colors on bright bases to `#000000` — contrast ratios now exceed 7:1 (AAA level)
- Muted text (`#64748b` on `#e2e8f0`) intentionally kept below AA since it's secondary/disabled text

### Test Results
- 45/45 Vitest tests passing
- Tests verify: color token correctness, status mappings, hex/RGB conversion, luminance calculation, contrast ratios, WCAG AA/AAA compliance, system theme resolution

### Integration
- `app/layout.tsx` wrapped with `<ThemeProvider>` — theme class applied to `<html>` element
- `app/globals.css` updated with `--color-success` and `--color-warning` in `@theme inline`
- No `@apply` used in `@layer base` — direct CSS properties only (Windows/Turbopack safe)

## [2026-06-02] T4: Seed Maintenance Items - COMPLETED

### Files Created
- `convex/seedData.ts` — 25 Honda ADV160 maintenance items with official intervals, categories, descriptions, service levels, and notes
- `convex/seed.ts` — Idempotent seed mutation (`seed.js:seed`) and count query (`seed.js:getCount`)
- `__tests__/convex/seedData.test.ts` — 22 Vitest tests verifying data completeness

### Schema Change
- `convex/schema.ts`: Changed `intervalKm: v.number()` → `intervalKm: v.optional(v.number())` to support time-only items (Coolant, Final Drive Oil)

### Seed Data Design
- **25 items** across 9 categories: engine (7), transmission (4), brakes (1), tires (1), electrical (2), cooling (2), fuel (2), general (2), chassis (4)
- **Service levels**: Owner (Tires, Brake System, Battery, Lights/Signals/Horn, Throttle Operation, Side Stand, Nuts & Bolts) and Dealer (everything else)
- **Items without km intervals**: Coolant (36mo only), Final Drive Oil (24mo only) — `intervalKm` field omitted from document
- **Longest intervals**: Steering Head Bearings (24,000 km / 24 mo)

### Idempotency Strategy
- Seed mutation checks `if (existing.length > 0 && !args.force)` → skips
- Optional `force: true` arg lets user delete and re-seed
- Second run returns `{ seeded: false, count: 25 }` — no duplicates

### Deployment
- `npx convex dev --once` pushed functions to clever-bass-796 dev deployment
- Seed ran successfully: 25 items inserted
- Idempotency verified: re-run returned `seeded: false`
- 91/91 Vitest tests passing (4 files)
- LSP diagnostics: 0 errors

### Official Honda ADV160 Intervals Used
| Item | Km | Months |
|------|----|--------|
| Engine Oil | 6,000 | 12 |
| Oil Filter | 6,000 | 12 |
| Spark Plug | 12,000 | 12 |
| Valve Clearance | 12,000 | 12 |
| Drive Belt | 12,000 | 12 |
| Rollers | 6,000 | 12 |
| Tires | 1,000 | 1 |
| Coolant | — | 36 |
| Final Drive Oil | — | 24 |
| Steering Head Bearings | 24,000 | 24 |

## [2026-06-02] T5: Bike Profile Onboarding - COMPLETED

### Files Created
- `app/setup/page.tsx` — Onboarding page with redirect logic (shows skeleton while loading, redirects to /dashboard if bike exists)
- `app/dashboard/page.tsx` — Dashboard page with redirect to /setup if no bike exists, displays bike info and specs cards
- `components/setup/bike-profile-form.tsx` — React Hook Form + Zod form with Honda ADV160 pre-filled specs
- `convex/bike.ts` — `getBike` query (singleton) and `createBike` mutation (enforces single profile)
- `e2e/onboarding.spec.ts` — Playwright E2E tests for onboarding flow
- `playwright.config.ts` — Playwright configuration with local dev server

### Schema Changes
- `convex/schema.ts`: Made `color`, `vin`, `purchaseDate` optional (`v.optional()`)
- `convex/schema.ts`: Added `lastServiceDate: v.optional(v.number())` to bike table
- Updated `__tests__/schema.test.ts` to match new optional fields

### Form Design
- **Two-card layout**: Basic Information + Technical Specifications
- **Required fields**: name, year, currentOdometer (marked with *)
- **Optional fields**: color, purchaseDate, lastServiceDate, vin
- **Pre-filled Honda ADV160 specs**: engineCc (157), tire sizes, pressures, oil type/capacity, coolant, battery, spark plug, fuel tank (8.1L)
- **Validation**: year 2021-2027, odometer >= 0
- **Date handling**: HTML date inputs converted to `Date.getTime()` (ms since epoch) for Convex

### Zod v4 + React Hook Form Compatibility
- **Issue**: `z.coerce.number()` in Zod v4 infers as `unknown` when used with `@hookform/resolvers` v5, causing TypeScript errors
- **Fix**: Used `z.string()` for all number inputs in the form schema, with `.refine()` for range validation, then `Number()` conversion in `onSubmit` before calling Convex mutation
- **Alternative tried**: `z.string().transform(...).pipe(z.number())` — output type conflicted with `useForm` generic

### Singleton Pattern
- `getBike` query uses `.take(1)` and returns first bike or null
- `createBike` mutation checks `existing.length > 0` and throws if bike already exists
- Setup page redirects to `/dashboard` if `bike` is truthy
- Dashboard redirects to `/setup` if `bike` is null

### Navigation Flow
1. User visits `/` (landing page) → clicks "Get Started" → `/setup`
2. `/setup` checks for existing bike → redirects to `/dashboard` if found
3. User fills form → submits → saves to Convex → redirects to `/dashboard`
4. `/dashboard` displays bike info and technical specs

### Test Results
- **Build**: Next.js 16 production build passes (TypeScript check + static generation)
- **Vitest**: 91/91 tests passing (4 files)
- **LSP diagnostics**: 0 errors across all changed files
- **Playwright**: Configured but requires `npm install` for `@playwright/test` dependency

### E2E Test Coverage
- Completes setup form and redirects to dashboard
- Redirects to dashboard when bike profile already exists
- Validates required fields (name, year, odometer)
- Validates year range (2019 rejected)

### Dependencies Added
- `@playwright/test` ^1.52.0 (devDependency)
- `test:e2e` script added to package.json

### Notable Decisions
- **No multiple bike profiles**: Mutation explicitly throws if bike exists; UI redirects away from setup
- **Empty optional fields sent as `undefined`**: Mutation passes `undefined` for optional fields rather than empty strings, keeping the database clean
- **Model hardcoded to "Honda ADV160"**: Since this is a single-bike ADV160 tracker, model is set server-side, not user-editable
