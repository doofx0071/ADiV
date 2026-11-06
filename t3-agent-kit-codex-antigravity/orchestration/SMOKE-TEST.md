# Smoke tests — two-provider setup

## Test 1: capability discovery (no changes)
Create a T3 thread with **Codex**, paste `LEAD-PROMPT.md`, and verify that T3 actually calls `orchestrator_capabilities`.

Then ask:

> Show the actual T3 Codex and Antigravity provider instance IDs, available models, and whether each instance can accept `delegate_task` tasks. Do not edit files, install anything, or show credentials.

Expected: two authenticated provider instances (or clear errors), and real tool output for any claimed capabilities.

## Test 2: real Google delegation (read-only)
After confirming Antigravity supports child delegation, ask:

> Using the providerInstanceId and model T3 returned for Antigravity, call `delegate_task` once with role `review` and READ-ONLY instructions to examine the project README and name three architecture risks, three test gaps, and recommended verification steps. Avoid private keys, tokens, `.env` and sensitive data. Track the returned task ID and show the actual result. Do not edit any file.

Expected: real Google child task and actual result. If Google cannot accept child delegation, do NOT fake it; open a separate manual Antigravity thread and paste the same review brief there.

## Test 3: small edit, after permission
Ask Codex to propose one minimal code change and its acceptance criteria; approve only after reviewing the proposed files. Keep it in the current thread until the read-only review works.

If later you want Codex and Antigravity to **both write** in parallel, ask the lead to create separate T3 **worktree-backed threads** and show exact branch/worktree paths before work begins.

## Problems
- Antigravity missing: check Settings > Providers in the correct environment; enable/install/sign in; wait for model catalog. Signing into the standalone Antigravity IDE doesn't automatically sign in T3.
- Only one Codex provider: correct; that's intentional.
- No `orchestrator_capabilities`: update T3; confirm project/provider session and T3 MCP injection. Do not manually invent bearer tokens.
- Antigravity visible but cannot accept delegated task: provider may lack required capability; use manual second thread.
- Changes collide: stop the conflicting sessions and use isolated worktree-backed threads or serialize edits.
- Account usage cap: stop and wait for legitimate reset; no account auto-switcher.
