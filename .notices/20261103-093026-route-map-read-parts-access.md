# DOWNSTREAM NOTICE id:20261103-093026-route-map-read-parts-access
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:feature/bundle3-ui-docs-tools | commit:- (this commit)
date: 2026-11-03T09:30:26+09:00
severity: info
checkpoint: route-map-read-parts-access
resolves: 20261101-124453-route-map-read-parts-access
change: route map / test:screens (parseLoaderGuard in src/lib/screens/checks.mjs) now read `createLoader({ access: <parts>.access, … })` as {"registry":"<domain>.<op>"}, same as createLoader(adminXxxParts("<domain>")); accepted: `const x = adminXxxParts("d"…)` bound once in the same file + `x.access`, or inline `adminXxxParts("d"…).access`
why: loaders that use admin parts for data but write their own load had to hand-write access literals, which do not follow the domain's access in serviceRegistry; nothing breaks if a fork does nothing
required_actions:
1. Optional: find loaders that bind admin parts and hand-write access (git grep -n -E "const \w+ = admin(List|Edit|Create|Sort)Parts" src/app), and in each, replace the literal `access: { … }` passed to createLoader with `access: <that const>.access` (keep the const declared once with const, parts imported from @/wiring/adminScreenParts, domain as a string literal)
2. If step 1 changed any loader: pnpm routes:map and commit src/app/route-map.jsonl (the access of those pages becomes {"registry":"<domain>.<op>"})
verify: pnpm routes:map --check && pnpm test:screens && pnpm test:screens-checks
manual_steps: -
refs: src/lib/screens/checks.mjs (partsAccessOf, parseLoaderGuard) | src/lib/screens/checks.test.mjs | src/lib/screens/README.md (chain access line, 既知の限界) | order 20261101-124453-route-map-read-parts-access
notes: upstream route-map.jsonl unchanged (no upstream loader uses the form) | rejected forms stay generation failures: destructuring, parts imported from another file, let/var, redeclared or reassigned name, non-literal domain, member chains beyond .access | oripa-do candidates (not checked for edits): admin bulletins and gacha-machines/new loaders
