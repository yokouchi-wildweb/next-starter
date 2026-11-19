# DOWNSTREAM NOTICE id:20261119-232024-context-condense
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261111-153718-claude-md-context.2-content | commit:- (this commit)
date: 2026-11-19T23:20:24Z
severity: action-required
checkpoint: context-condense
change: A new key hotfix (CLAUDE.md REPO_LINK, core notices.md), the card key viewport vp_old_paths removed, and CLAUDE.md condensed under its notify line (38,535 -> 36,913 chars) by turning items whose core file or card holds the same detail into the source key's summary + a pointer; no CLAUDE.md key renamed or removed.
why: a fork rule file that points at .claude/rules/items/lib/viewport.md vp_old_paths now points at nothing, and forks follow the new hotfix key and the deps wording that now matches core/lib.md.
required_actions:
1. Merge upstream up to this checkpoint (CLAUDE.md, .claude/rules/core/** and items/** are parent-owned: take upstream's).
2. Key table: .claude/rules/items/lib/viewport.md vp_old_paths -> removed (the gone old paths are still shown by lint deprecated-imports, which points to @/lib/viewport). Find your own references: git grep -n -E 'vp_old_paths' -- .claude/rules ':!.claude/rules/core' ':!.claude/rules/items' → drop them.
verify: the git grep of step 2 shows nothing; pnpm check rules passes (Tier1-only failures are a count line in a fork)
manual_steps: -
refs: CLAUDE.md REPO_LINK hotfix, .claude/rules/core/notices.md hotfix, .claude/rules/core/lib.md deps, .claude/rules/core/design.md size
notes: The segment's items (order numbers = the upstream build steps):
(1) change: new key hotfix in CLAUDE.md REPO_LINK and core notices.md: a fix the human calls urgent = /ship hotfix, the notice's hotfix: field makes forks take it ahead of every other segment, only on the human's words, never on your own judgment; /ship checks pickCheck and hotfixCheck  (order 100)
(2) keys: .claude/rules/items/lib/viewport.md vp_old_paths -> removed; src/lib/viewport/README.md Usage loses its old-path line  (order 100)
(3) change: CLAUDE.md condensed (38,535 -> 36,913 chars): DOMAINS commands / schema_registry / push_roundtrip / service_registry / field_types / domain_config / setting, REPO_LINK notice / resolves / relay / hotfix, CORE_FILES fork_ownership, CODE_PLACEMENT library, RULES_FILES, SCREENS route / route_groups / page_guard, CRUD_SERVICE audit, BACKENDS unconfigured, DIRECTORY_STRUCTURE code_generation / db_identifiers now give the source key's summary + a pointer; keys, MANDATORY marks and the laws unchanged  (order 101)
(4) change: CODE_PLACEMENT deps: features→features (server) goes through the target's public services (its services/server entry), as core/lib.md deps already said (CLAUDE.md said "direct OK"); RULES_FILES lineage.md: a section's change → /order <its owner>  (order 101)
