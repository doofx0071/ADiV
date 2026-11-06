# AdiV logical agent instructions

These files define task-specific roles for T3 delegation. They do not register persistent agents or change T3 permissions. The lead chooses only the role needed and explicitly includes its file in the child brief.

## Lead and managers

- `LUNA-COMMANDER.md` — Codex lead.
- `CODEX-ENGINEERING.md` — optional Codex engineering manager.
- `ANTIGRAVITY-SPECIALISTS.md` — optional Antigravity specialist manager.

## Specialists

- Codex: `CODEX-BACKEND.md`, `CODEX-FRONTEND.md`, `CODEX-DEBUGGER.md`, `CODEX-INTEGRATOR.md`.
- Antigravity: `AG-RESEARCHER.md`, `AG-DOCUMENTATION.md`, `AG-SECURITY.md`, `AG-REVIEWER.md`, `AG-TESTER.md`, `AG-DESIGN.md`.

Read `.ai/ROUTING.md` for task tiers and team limits. Before project work, read the root `AGENTS.md` and the most specific nested instructions. For Next.js code, read the relevant guide in `node_modules/next/dist/docs/`; for Convex code, first read `convex/_generated/ai/guidelines.md`.

T3 children do not inherit the full parent conversation. Each brief must include the objective, relevant paths, boundaries, logical role and file, expected output, and acceptance criteria. T3's `delegate_task` role is generic; the logical names here are prompt-level roles.
