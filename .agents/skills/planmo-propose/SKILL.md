---
name: planmo-propose
description: Propose a plan change for PlanMo to validate and apply.
---
Read `planning/MASTER-PLAN.md`, `planning/CONTEXT.md` and `planning/tasks.csv`.

Then produce ONE JSON document and nothing else — no prose around it:

```json
{
  "schemaVersion": 1,
  "agent": "<your agent id>",
  "requestId": "<what you were asked>",
  "items": [{ "id": "<stable-id>", "summary": "<what should change and why>" }]
}
```

Proposed changes are DELTAS, not commands. Do not edit any project file
yourself: save the JSON as `proposal.json` and tell the user to run
`npx -y planmo agent apply proposal.json`, which validates it before anything
changes.
