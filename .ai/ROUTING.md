# T3 model routing and operating limits

Use the least resource-intensive available model that can reliably complete the task. Correctness and safety remain the acceptance bar. This policy guides the lead; T3 does not automatically route tasks from this file.

## Task tiers

| Tier | Task | Preferred route |
|---|---|---|
| 0 — Trivial | Simple explanation, status, or one-step answer | Lead answers directly; no delegation |
| 1 — Lightweight | Documentation, simple research, summaries, test ideas | `antigravity` / `gemini-3.8-flash`; delegate only when it reduces lead work |
| 2 — Standard development | Ordinary component, endpoint, validation, or bug fix | `codex` / `gpt-6.1-terra`; apply the Antigravity checkpoint to substantial or cross-module work |
| 3 — Complex development | Cross-module work, difficult debugging, major refactor | `codex` / `gpt-6.1-sol` lead plus the required Antigravity analysis/review checkpoint |
| 4 — High-risk | Security-sensitive work, major architecture, production data | Lead plans and assigns a safe independent review; follow the checkpoint when information can be shared safely; seek approval for consequential actions |

Use only provider IDs and models present in the current T3 capability result. Preferred IDs above were observed for this project; they are not a substitute for capability discovery in a new or stale session. Claude Sonnet requires explicit user approval. Never select Claude Opus automatically.

## Required Antigravity checkpoint

For development that spans multiple modules or app layers, difficult debugging, a substantial feature, a major refactor, or a high-risk change, the Codex lead must assign one bounded, read-only Antigravity task before final integration. Use it for independent problem analysis, edge-case/test design, or review of the first reviewable diff. Do not assign overlapping code changes to this checkpoint worker.

Before dispatch, use the current T3 capability result to confirm Antigravity child-task support and select an advertised Antigravity model. Include the provider instance, model, title, T3 role, logical role and its `.ai/agents/` file, task boundaries, expected evidence, and acceptance criteria in the `delegate_task` brief. Track the task to completion and consider its findings before integrating.

Skip the checkpoint only when the task is trivial or mechanical, no independent bounded task exists, the provider/model or child-task capability is unavailable or capped, the permission mode blocks it, the brief would expose information that cannot safely be shared, or the user asks for no delegation. State the specific reason in the final report. Do not switch accounts or providers to route around a cap. A read-only brief is not a read-only sandbox; follow the active T3 permission mode and report the child's actual runtime when relevant.

## Delegation and usage controls

- Handle trivial work directly. Default to one worker; allow no more than two active delegated workers across the hierarchy and no more than two delegation levels below the lead.
- The two-worker and depth limits are lead-managed policy. T3 reports `maxBatchThreads`, which is not enforcement of these limits. Track active tasks and depth in the lead thread.
- Delegate only independent, bounded work. Avoid duplicate analysis, unnecessary parallel work, repeated context, and separate reviewers for routine changes.
- A Level 1 manager may assign a Level 2 logical role only when the lead explicitly authorizes nested delegation. If nested delegation is unavailable, the lead assigns a flat child task.
- Before the first child task in a T3 thread, call `orchestrator_capabilities` once. Reuse the result unless a provider fails or the information becomes stale. Never invent model IDs, instance IDs, quotas, or savings.
- Every `delegate_task` must specify provider instance, model, title, T3 role, mode, logical role, and a self-contained task brief with constraints, expected output, and acceptance criteria. Do not create a child checkout in a shell. For parallel writes, use T3 worktree-backed threads or serialize the work.
- Codex and Antigravity use separate subscription allowances. Never pool accounts, rotate subscriptions, add proxy services, or route around provider limits. If a provider is unavailable or capped, stop and report it.

## Permissions

- Follow the active T3 permission mode. Use `approval-required` for operations that need approval and do not bypass, suppress, or work around permission prompts.
- A read-only instruction in a task brief is not a read-only sandbox. Do not delegate sensitive read-only work unless the runtime and scope are appropriate; report the actual child runtime when relevant.
- No worker may deploy, push, merge, delete data, alter production/security settings, or install major dependencies without user authorization.
