# project

## overview
- name: {{name}}
- type: {{overview}}
- repo: {{origin}} (origin) | upstream: {{upstream}}
- phase: TBD (experimental | pre-launch | production, real users yes/no)
- direction: TBD (how the product grows, 1-3 lines)

## tier_only
this_repo: tier {{tier}} in repo.json, direct fork of {{parent}}
- name and tier: repo.json at the repo root (`repo_id`, `tier` root | middle | leaf), written by `pnpm workflow repo-json set` | the same name names the ledger .notices/applied/<name>.md, permits .fork-ownership/<name>.permits.txt, this repo's src/lib/CATALOG.md section heading, the order inbox | reader: src/lib/forkOwnership/forkIds.mjs
- rule: generic / foundational capabilities live in Tier1, never hardcoded here → /order <the repo that owns it> | this repo's own business lives HERE
- backend_status: TBD (firebase / neon configured or not, and what is inactive until then)
- architecture_delta: TBD (only where this repo differs from upstream CLAUDE.md, never restate it)
- domains: TBD (priority order, one folder each under src/domains/)

## maker
- TBD (what this tier promises to its downstream forks; a leaf may leave TBD)
