# DOWNSTREAM NOTICE id:20261114-224029-user-group-evaluation
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-14T22:40:29+09:00
severity: action-required
checkpoint: user-group-evaluation
change: (1) userGroup evaluation API (userGroupService / userGroupEvaluator, src/features/core/userGroup/services/server): count({ groupId } | { definition }) → { count, memberLimit, overLimit }, isMember(groupId, userId), listMemberIds(groupId, { cursor, limit }) (keyset by user id), evaluate(definition, { sampleLimit }) (count + sample, not saved). Static = members, scheduled = the current version's members, dynamic = the definition tree compiled to one SQL predicate on users (population = not-deleted users). Errors: gate userGroups closed 404, missing group 404, archived / broken / scheduled without a version / heavy dynamic isMember 409, inline definition 400, over the evaluation.timeoutMs statement timeout 503. (2) Six upstream criteria (receptacle criteria, all cheap): role, status, signupPeriod, lastLoginPeriod (notWithinDays counts never-logged-in users), hasTag (any / all), inStaticGroup. (3) user: the public predicate availableUserWhere({ includeDemo? }) (@/features/core/user/services/server/availableUsers) and indexes users_status_idx, users_deleted_at_idx, users_last_authenticated_at_idx, user_to_user_tag_tag_idx. (4) Behaviour: messaging all / role sends and their estimates now exclude demo users (is_demo) through the user domain's availableUserWhere(); selected-user sends are unchanged.
why: Groups need one evaluation path for every user (message targets, limited pages, eligibility); "available user" had four separate definitions and none excluded demo users.
required_actions:
1. Merge upstream up to this checkpoint; pnpm generate extensions.
2. [user-run] pnpm db:push (4 CREATE INDEX on users / user_to_user_tag) at maintenance / low traffic (the index build locks the tables briefly on large DBs), then pnpm db:push:check = 0.
3. A fork that relies on demo users receiving all / role sends: send them with a selected-user send, or read availableUserWhere({ includeDemo: true }) in its own sender. Find: git grep -n "is_demo\|isDemo" -- src ':!src/features/core'
4. A fork with its own criteria: add criteria/<name>.ts receptacle items (UserGroupCriterion: SQL predicate on users only; non-SQL conditions go to a static group).
verify: pnpm typecheck, pnpm lint, pnpm test, pnpm check pass; pnpm test --db src/features/core/userGroup passes; pnpm db:push:check = 0
manual_steps: [user-run] pnpm db:push
refs: src/features/core/userGroup/README.md (評価の口, 上流の部品), src/features/core/user/README.md (利用できる利用者の述語), council 20261108-120538-system-messaging-templates (legate l2, order 46)
notes: The gate userGroups stays closed by default; nothing upstream calls the evaluation API yet (the static writer, the scheduled cron and the admin screen come next).
