# DOWNSTREAM NOTICE id:20261103-085057-generate-false-domain-entry-doc
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:feature/bundle3-ui-docs-tools | commit:- (this commit)
date: 2026-11-03T08:50:57+09:00
severity: info
checkpoint: generate-false-domain-entry-doc
resolves: 20261026-081029-registry-false-domain-entry
change: registry:check / registry:generate no longer point a "generate": false business domain without domainEntry.ts (or with a legacy hand-written serviceRegistry row) at `pnpm dc:generate <d> --only registry`, which writes nothing for it; they now say to hand-write domainEntry.ts and point to the new ready-to-copy form in src/lib/domain/README.md「generate: false の業務ドメイン」 (same text the generator writes; test:service-registry keeps the two equal)
why: a fork whose business domain is hand-managed (e.g. moved from the abolished generateFiles.registry:false) could not reach a passing registry:check by following the docs; it needed an ad-hoc script
required_actions: none
verify: pnpm registry:check | pnpm test:service-registry
manual_steps: -
refs: src/lib/domain/README.md「generate: false の業務ドメイン」 | scripts/domain-config/README.md「generate の旗」 | scripts/registry/serviceRegistry/generate.mjs | .notices/20261025-213009-domain-entry-registry.md (step 2 does not cover generate:false domains: follow the README section instead)
notes: message and docs only, no behavior change. A fork that already hand-wrote such a domainEntry.ts (e.g. TriQ 0960ac2b) needs nothing. dc:generate still writes nothing for generate:false domains (no new option, by decision)
