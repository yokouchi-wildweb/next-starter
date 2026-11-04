# DOWNSTREAM NOTICE id:20261104-091518-eslint-required-rules
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-04T09:15:18Z
severity: info
checkpoint: eslint-required-rules
change: New check pnpm eslint:required (scripts/eslint/requiredRules.mjs), called by pnpm build: the all-tier required ESLint rules listed in eslint-rules/required-rules.mjs (15 rules: route-http-export, import-boundaries x7, page-authz x2, no-server-action, core-ui-entry, realtime-room/purity, hidden-columns/no-raw-select, audit/action-naming) must still be "error" in the final config after eslint.config.fork.mjs is read last. Turning one off or to warn in the fork config now fails the build.
why: eslint.config.fork.mjs loads last, so a fork could switch off security / boundary rules. Forks stay free to add rules and to lower any rule outside the list; per-line reasoned eslint-disable stays allowed.
required_actions:
1. pnpm eslint:required
2. If it fails: remove the override of each listed rule from eslint.config.fork.mjs (git grep -n "<rule name>" -- eslint.config.fork.mjs). Where one place really needs an exception, use a reasoned per-line `// eslint-disable-next-line <rule> -- <reason>` instead.
verify: pnpm eslint:required prints OK; pnpm build passes its checks.
manual_steps: -
refs: eslint-rules/required-rules.mjs, scripts/eslint/requiredRules.mjs, scripts/README.md (ESLint の必須規則), package.json build, order 20261101-171224-eslint-required-rules-check
notes: Checked at this commit with each local fork's eslint.config.fork.mjs placed after the upstream config: 88-base, TriQ, next-vnx (empty), oripa-do, pandora (3 entries) and boardgame-site (style-tokens/no-raw-palette only, outside the list) all pass unchanged. The order came from this repo's council (no resolves:). The unified entry lint (council D82) joins the list when it lands.
