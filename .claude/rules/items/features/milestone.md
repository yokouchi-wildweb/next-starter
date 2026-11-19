---
paths:
  - "src/features/core/milestone/**"
---
# features/milestone
what: detects and records a user reaching a condition at integration points (purchase_completed, user_registered, own triggers) and runs onAchieved | entry evaluateMilestones (services/server/wrappers), client MilestoneNotifications
use: milestone
change: add → src/features/core/milestone/extensionPoints.ts: definitions (services/server/definitions/<name>.ts) and renderers (components/renderers/<name>.ts(x)), then pnpm generate extensions
rules:
using:
- milestone_gate_check: a new integration point checks gate.enabled("milestone") before calling evaluateMilestones
- milestone_grant_tx: onAchieved writes grants through params.tx (record and grant commit together) | side effects outside the DB (mail) go after the tx | the general rule = core/services.md tx_side_effects
- milestone_after_register: user_registered never rolls back the registration → never put work there that must undo it
- milestone_stage_key: a series stageKey comes from the stage's name, never its index (records must keep matching)
- milestone_renderer_item: a renderer key = the definition or series key, unique | the receptacle holds the item only, the component lives in its owning domain
- milestone_display: upstream screens never render MilestoneNotifications | a fork shows it in its _components/ Screen behind useGate().enabled("milestone"), or sends elsewhere from onAchieved
editing:
- milestone_record_first: the record (insert … on conflict do nothing) is fixed before onAchieved, which runs only when the row came back | one SAVEPOINT (with tx) or db.transaction (without) per item
read: define, series, recipes, own trigger, renderer, where to show → Usage | fields, context, payloads, result and renderer types → src/features/core/milestone/API.md API | receptacles → Extension | evaluation flow, idempotency → Internals | tests → Verification
