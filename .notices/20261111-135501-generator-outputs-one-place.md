# DOWNSTREAM NOTICE id:20261111-135501-generator-outputs-one-place
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:main | commit:- (this commit)
date: 2026-11-11T13:55:01+09:00
severity: info
checkpoint: generator-outputs-one-place
change: A generator's gate.json `outputs` is now the one place it declares its outputs: each entry is a glob string (= every-run, as before) or { glob, kind?: "every-run" | "write-once", source? }. The pnpm generate domain output kinds moved from scripts/structure/domain/outputs.json into scripts/structure/domain/gate.json `outputs` (same glob / kind / source); outputs.json is deleted. The intake generated rows (src/lib/forkOwnership/intake.txt) come only from every-run entries without domain placeholders ({dir} {camel} {Pascal} {route}), so intake.txt, pnpm workflow ownership check and pnpm workflow ownership who give the same results as before.
why: two places declared generator outputs (gate.json outputs and domain/outputs.json); one source of truth avoids drift
moved: scripts/structure/domain/outputs.json -> scripts/structure/domain/gate.json
required_actions: none
verify: `pnpm check extensions` (intake.txt unchanged); `pnpm workflow ownership who <path>` answers as before
manual_steps: -
refs: scripts/runner/gates/README.md (outputs), scripts/structure/domain/README.md 「出力の種類のデータ」, src/lib/districtMap/domainOutputs.mjs, order 20261111-135203-generator-outputs-one-place
notes: the moved entries live in gate.json `outputs`. Forks do not edit these files (upstream scripts/). A fork's own gate.json with plain-string outputs stays valid and means every-run. A fork that read outputs.json in its own tooling reads scripts/structure/domain/gate.json `outputs` instead (parseDomainOutputs in src/lib/districtMap/domainOutputs.mjs keeps its name and return shape).
