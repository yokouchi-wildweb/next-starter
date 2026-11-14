# DOWNSTREAM NOTICE id:20261114-203349-user-group-foundation
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-14T20:33:49+09:00
severity: action-required
checkpoint: user-group-foundation
change: New core domain src/features/core/userGroup (user groups, D96-D104): tables user_groups, user_group_definitions, user_group_members, user_group_versions, user_group_version_members (no column or table on users); the criteria receptacle criteria/<name>.ts (export const criterion: UserGroupCriterion from @/features/userGroup/types = { key, label, description?, args zod, fields: FieldConfig[], weight cheap | heavy, where(args, { now }) → SQL predicate on users }; 0 upstream items); the definition tree check checkUserGroupDefinition (and / or / not, node / depth limits, unknown part or bad args = DomainError 400, returns heavy); config userGroupConfig (memberLimit 100000, definition.maxNodes 50 / maxDepth 6; fork values in src/config/features/userGroup.config.ts); gate rule userGroups (default closed; closes the whole domain: tables, generic API, cron, /admin/user-groups, /api/admin/user-groups); domainEntry userGroup (INTERNAL_ONLY). Readers (count / isMember / listMemberIds / evaluate), upstream criteria, the static writer, the scheduled cron and the admin screen come in later checkpoints.
why: Many features need named sets of users (message targets, limited pages, eligibility); a general core domain replaces per-feature lists (messaging audiences go later) and the fork-specific segment implementations (D96: forks move onto this one).
required_actions:
1. Merge upstream up to this checkpoint; pnpm generate extensions, pnpm generate registry, pnpm generate district-map.
2. [user-run] pnpm db:push (5 new tables), then pnpm db:push:check = 0.
3. Nothing to open yet: the gate userGroups stays closed by default (open it in src/config/featureGate/switches.config.ts only when a later checkpoint ships a use).
verify: pnpm typecheck, pnpm lint, pnpm test, pnpm check pass; FEATURE_GATE_CHECK=all pnpm test src/featureGate scripts/structure/proxies passes; pnpm db:push:check = 0
manual_steps: [user-run] pnpm db:push
refs: src/features/core/userGroup/README.md, council 20261108-120538-system-messaging-templates (legate l2, order 45)
notes: A fork with its own segment / group implementation (e.g. userSegment) keeps it for now; moving onto userGroup comes with the checkpoint that ships the readers and criteria.
