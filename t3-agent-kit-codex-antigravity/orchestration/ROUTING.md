# Task routing — only Codex + Antigravity

| Task | First choice | Secondary review | Safety |
|---|---|---|---|
| Architecture/overall project plan | Codex (lead) | Antigravity read-only critique | Check project constraints |
| Backend APIs, DB, Laravel (or verified stack) | Codex | Antigravity review | Approve destructive migrations |
| Frontend UI and components | Codex or Antigravity | Other provider reviews | No overlapping writes |
| Research and alternatives | Antigravity | Codex validates | Check sources independently |
| Accessibility, UX, security review | Antigravity | Codex decides | No secrets in child brief |
| Test-case design and code QA | Antigravity | Codex runs/verifies tests | Never claim tests ran if not |
| Integration/merge | Codex | Antigravity independent review | Require explicit approval if risky |
| Tiny one-file edit | Codex current thread | Focused test | Avoid delegation overhead |

**Model selection:** Read actual provider instance IDs and model lists from T3 `orchestrator_capabilities` each session; never assume a particular Google model or a hard-coded instance ID. These are *routing instructions* for an agent, not an automatic model router/daemon.

**Sharing a worktree:** `delegate_task` may inherit the same project/branch/checkout. Parallel read-only tasks are usually fine; parallel writes require T3 threads bound to isolated worktrees (`t3_thread_launch` with worktree strategy) or sequential execution.

**Limits:** Codex lead and any Codex child share one Plus allowance. No rotating accounts for capacity.
