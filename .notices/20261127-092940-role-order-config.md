# DOWNSTREAM NOTICE id:20261127-092940-role-order-config
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:07d512247
date: 2026-11-27T09:29:40+09:00
severity: action-required
checkpoint: role-order-config
change: The role list order (src/domains/core/user/extensions/roles.ts = the DB enum user_role order) comes from the new user config key `roleOrder` (src/config/domains/user.config.ts; the generator reads it as a literal; default [] = keep the current list). Order = roleOrder → roles not in it keep their place in the current list → new roles last. Duplicates stop the generator; an id with no role file is skipped with one line. Removed: `pnpm generate role -- --order <id,…>` (write roleOrder, then `pnpm forge`)
why: roles.ts is a generated file, so taking upstream's roles.ts at a take-in made the regeneration fix upstream's order and plan a rewrite of the production users table (caught only by db:push:check) (D490 (3))
required_actions:
1. Read your own role order: `git show HEAD:src/domains/core/user/extensions/roles.ts` as it was before this take-in (the import order; if the merge took upstream's version, use the version on your main before the merge), or the DB enum: `pnpm ops db inspect query "SELECT unnest(enum_range(NULL::user_role))"`
2. Write it into src/config/domains/user.config.ts as a literal key of the default export: `roleOrder: ["<id>", "<id>", …]` (every role id, in that order)
3. `pnpm forge`
verify: `git diff src/domains/core/user/extensions/roles.ts` shows no reordering against your pre-merge version, and `pnpm db:push:check` reports 0 statements
manual_steps: -
refs: scripts/structure/role/roleOrder.mjs, scripts/structure/role/generate.mjs (generateAll), src/domains/core/user/config.ts (roleOrder), src/config/domains/user.config.ts, src/domains/core/user/README.md, .claude/rules/core/domain-definition.md (roles: list order)
notes: Upstream ships no roleOrder value. A fork that never took upstream's roles.ts can still run the steps (its current roles.ts is its order). Checked on a copy of oripa-do: roleOrder = its order (admin, editor, debugger, contributor, simulator, user) → roles.ts unchanged; roles.ts replaced by upstream's (admin, user, editor, debugger, contributor) → regenerated back to oripa-do's order. Fork-specific impact beyond that: not checked.
