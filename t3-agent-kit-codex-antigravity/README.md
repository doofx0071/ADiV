# T3 Code — One Codex + One Google Antigravity Starter Kit

This revision replaces the earlier **three-Codex-accounts** version. Use **one ChatGPT Plus sign-in for Codex** and **one Google AI Pro sign-in for Antigravity**. Do not add an account pool, CLIProxyAPI proxy, or an account auto-switcher.

## What's in this kit
- `WINDOWS-SETUP.md` — installation and account sign-in checklist.
- `AGENTS.example.md` — repository-level agent guardrails (copy/merge into `AGENTS.md`).
- `orchestration/LEAD-PROMPT.md` — paste into a **Codex** lead thread.
- `orchestration/ROUTING.md` — decision policy for these **two providers**.
- `orchestration/SMOKE-TEST.md` — verify real T3 orchestration tools and an actual Google delegation.

## What it does and doesn't do
This is a set of instructions/prompts, **not** a background router, MCP implementation, T3 plugin or executable. T3 provides the authenticated orchestration MCP and agent-management features. The lead agent uses those tools when supported and available. The prompt cannot force a provider to support a model or delegation feature.

## Setup sequence
1. Install or update T3 Code for Windows; open your existing project folder.
2. Connect **one** ChatGPT Plus account to Codex; disable/disconnect extraneous Codex instances if configured.
3. Enable/install Antigravity in the same local environment; use **Google account** sign-in with Google AI Pro. Wait for models to appear.
4. Set default new-thread permissions to **Supervised**.
5. Add or merge `AGENTS.example.md` into your project's root `AGENTS.md` (do not overwrite existing instructions blindly).
6. Start a **Codex** thread in the project. Paste `orchestration/LEAD-PROMPT.md` into its first message.
7. Run `orchestration/SMOKE-TEST.md` **read-only**. Inspect the real tool calls and instance IDs.
8. Only after the read-only tests work, delegate small coding work and review diffs before integrating.

## Sources
- https://github.com/pingdotgg/t3code/blob/main/docs/user/install.md
- https://github.com/pingdotgg/t3code/blob/main/docs/user/providers-codex.md
- https://github.com/pingdotgg/t3code/blob/main/docs/user/providers-antigravity.md
- https://github.com/pingdotgg/t3code/blob/main/docs/user/permission-modes.md
- https://github.com/pingdotgg/t3code/blob/main/docs/orchestration-v2/orchestrator-mcp-server.md

## Note on subscriptions
Provider usage remains subject to subscription terms, model availability and rate limits. No tool can guarantee zero account risk. If a provider reports limits or unsupported access, stop or use an allowed manual alternative; do not rotate accounts to circumvent limits.
