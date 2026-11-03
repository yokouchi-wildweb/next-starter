# DOWNSTREAM NOTICE id:20261104-084536-codemod-display-spread
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-04T08:45:36+09:00
severity: info
checkpoint: codemod-display-spread
fixes: 20261101-121000-domain-display-client
resolves: 20261103-103348-domain-display-codemod-spread-miss
change: scripts/codemods/domain-json-client-display.mjs no longer misses an object spread of the removed domain.json import (`{ ...config }`): such a file is left unchanged and listed under "書き換えなかったファイル(手で移す)" with the reason "丸ごと展開している(...config)"
why: the codemod of notice 20261101-121000-domain-display-client removed the import but left `...config` behind without listing the file, so the fork had an uncompilable file that only pnpm typecheck revealed
required_actions: none
verify: `pnpm test:codemods` passes
manual_steps: -
refs: scripts/codemods/domain-json-client-display.mjs | scripts/codemods/domain-json-client-display.test.mjs | order 20261103-103348-domain-display-codemod-spread-miss
notes: a fork that already applied 20261101-121000-domain-display-client and passes pnpm typecheck has nothing to do (oripa-do fixed AdminGachaMachineList/Table.tsx by hand in 67c6cdf06). A fork that has not applied it yet gets the spread file in the hand-fix list when it runs the codemod. Spreads are listed rather than rewritten because the display copy holds only part of domain.json's keys
