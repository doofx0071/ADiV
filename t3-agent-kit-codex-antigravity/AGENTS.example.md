# Project instructions for AI agents (Codex + Antigravity)

These are local project working agreements. They do not change the permissions granted by T3 Code.

## Repository discipline
- Inspect the current repository, active Git branch, relevant README and architectural files before edits.
- Scope changes narrowly. Do not overwrite other threads' in-progress work, and do not work concurrently on the same files in one checkout.
- Use separate Git worktrees for genuinely parallel code-changing threads, or perform edits sequentially.
- Keep changes reviewable; favor tests over large speculative rewrites.

## Safety and user approval
- Never output, copy into prompts, commit or disclose secrets, tokens, `.env` contents, private keys, or credentials. Use sanitized fixtures when testing.
- Ask approval before deleting data, destructive migrations, changing authentication/security configuration, deploying, pushing, or installing major dependencies.
- Report every command/test that actually ran; never fabricate tool calls, results, tests, provider models or agent delegation.
- Respect provider usage limits. Never rotate providers/accounts to evade quota or policy controls.

## Hand-off to lead
Report scope, changed files, any new dependencies, tests and results, known risks, unfinished items and exact blockers.
