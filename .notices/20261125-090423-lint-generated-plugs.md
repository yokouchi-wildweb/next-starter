# DOWNSTREAM NOTICE id:20261125-090423-lint-generated-plugs
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:aec106379
date: 2026-11-25T09:04:23+09:00
severity: action-required
checkpoint: lint-generated-plugs
fixes: 20261123-040814-district-stage3
pick: -
change: lint entry/only-entries lets a file with the generated mark (`// 生成物・編集不可: `, e.g. the lib knots src/wiring/startup.ts and src/wiring/serverErrorReport.ts written by `pnpm generate extensions`) import a lib's items under src/lib/<lib>/plugs/**. Since district-stage3 such an import failed as libInner (a fork lib's own item, e.g. src/lib/<lib>/plugs/serverErrorReporters/<name>.ts, read by the generated knot), because only generated lists under …/extensions/ were exempt and a lib's exports never carry plugs. From files without the mark, and for a lib's files outside plugs/, the entry rule is unchanged.
why: a fork lib that plugs an item into a lib point (district-stage3: non-business items live in <lib>/plugs/<point>/) could not pass `pnpm lint`, so forks moved the item into one of their domains as a stopgap.
required_actions:
1. Only if the fork moved a lib's item into one of its own domains to get past this error: move it back to src/lib/<lib>/plugs/<point>/<name>.ts, delete the temporary copy, run `pnpm generate extensions`. Nothing moved → nothing to do.
verify: `pnpm lint` passes with every lib item under src/lib/<lib>/plugs/ and the generated knot importing it
manual_steps: -
refs: eslint-rules/entry.mjs, src/lib/README.md (entry/only-entries)
notes: Fork-specific impact: not checked.
