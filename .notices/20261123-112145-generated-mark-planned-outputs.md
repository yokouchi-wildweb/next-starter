# DOWNSTREAM NOTICE id:20261123-112145-generated-mark-planned-outputs
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:qc/kagerou/o/20261123-111525-generated-mark-check-when-condition | commit:- (this commit)
date: 2026-11-23T11:21:45+09:00
severity: info
checkpoint: generated-mark-planned-outputs
fixes: 20261119-024228-v2-content
resolves: 20261121-044514-generated-mark-check-when-condition
change: pnpm check rules (generated-mark check) counts a domain generator's every-run output only when the generator actually writes it for that domain (the same plan as pnpm generate domain, no write) — a conditional output (e.g. components/common/{Pascal}DetailModal.tsx, only with useDetailModal) of a domain whose condition is false is no longer a generated file
why: the check matched scripts/structure/domain/phase.json globs alone; a fork's hand-written part with the same name in a domain where the generator never writes it failed as "mark missing"
required_actions: none
verify: pnpm check rules passes with a domain that has useDetailModal false and a hand-written components/common/<Pascal>DetailModal.tsx without the mark; a real every-run output without its mark still fails | pnpm test scripts/workflow/rules/ruleGenerated.test.mjs scripts/structure/domain/tests/dryRun.test.mjs
manual_steps: -
refs: scripts/workflow/rules/generated.mjs | scripts/workflow/rules/lib.ruleGenerated.mjs (outputFiles domainEveryRun) | scripts/structure/domain/pipeline/generateAll.mjs (planGenerateAll, everyRunPathsOf) | order 20261121-044514-generated-mark-check-when-condition
notes: a domain.json the generator cannot plan (preflight error) now fails pnpm check rules with that message (the mark cannot be judged without the plan); pnpm generate domain -- --dry-run shows the same error | a mark you added by hand to such a part to pass the old check may be removed
