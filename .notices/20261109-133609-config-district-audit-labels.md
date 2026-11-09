# DOWNSTREAM NOTICE id:20261109-133609-config-district-audit-labels
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-09T13:36:09+09:00
severity: action-required
checkpoint: config-district-audit-labels
moved: src/config/app/audit.config.ts -> src/config/features/auditLog.config.ts
change: the audit log values moved from src/config/app/audit.config.ts (deleted) to their owner src/features/core/auditLog/config.ts (defaults, type AuditLogOverride, composed auditLogConfig) with the empty override src/config/features/auditLog.config.ts. Old name -> new key: AUDIT_ACTION_LABELS -> auditLogConfig.actionLabels | USER_VISIBLE_AUDIT_ACTIONS -> auditLogConfig.userVisibleActions. Values unchanged (both empty upstream).
why: a fork that wrote action labels or user-visible actions in the old file loses them (the file is gone), and a fork file importing @/config/app/audit.config fails typecheck
required_actions:
1. Merge upstream up to this checkpoint. If the merge keeps a fork version of src/config/app/audit.config.ts (modify/delete conflict), copy its values first, then delete the file: `git show HEAD:src/config/app/audit.config.ts`.
2. Write the fork's values into src/config/features/auditLog.config.ts as literals: `export default { actionLabels: { "<action>": "<label>", ... }, userVisibleActions: ["<action>", ...] } satisfies AuditLogOverride;` (leave out a key the fork did not change). [判断] oripa-do: its old file has about 7 action labels (user_profile.*, messaging.message.*, step_up.stage.*) in AUDIT_ACTION_LABELS → move them all to actionLabels; its USER_VISIBLE_AUDIT_ACTIONS is empty → nothing to write. 88-base, TriQ, boardgame-site, next-vnx: both values empty → nothing to write.
3. Rewrite fork imports: `git grep -nE "config/app/audit\.config|AUDIT_ACTION_LABELS|USER_VISIBLE_AUDIT_ACTIONS" -- src scripts` → read `auditLogConfig` from `@/features/auditLog/config` and use `.actionLabels` / `.userVisibleActions` (no re-export of the old names).
verify: the git grep in step 3 finds nothing | pnpm check config-overrides passes | pnpm typecheck | pnpm lint | the admin audit timeline shows the fork's labels as before
manual_steps: -
refs: src/features/core/auditLog/config.ts, src/config/features/auditLog.config.ts, src/features/core/auditLog/README.md, src/config/README.md, order 20261109-131130-config-district-audit-labels
notes: Fork diffs were read with git show HEAD:src/config/app/audit.config.ts in each fork of fleet.conf (read-only). .claude/rules/core/audit.md paths: now point at the owner config and its override.
