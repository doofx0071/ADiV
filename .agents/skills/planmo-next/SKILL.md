---
name: planmo-next
description: Show the next PlanMo task and the context to work it.
---
Run `npx -y planmo next --print` and follow the directive it prints.

Read the files it names before changing anything. Respect the task scope:
change only what the task requires, and add no adjacent edits.

Do not explore beyond that. In particular: do not read PlanMo’s own installed
source under node_modules, and do not scan the rest of the planning tree — the
brief already names everything this task needs.

Record durable decisions in the documents the brief lists as yours. Everything
else under planning/ is generated: regeneration overwrites it, so anything
written there is lost.

When you are done, run `npx -y planmo validate` and report its exact output.
