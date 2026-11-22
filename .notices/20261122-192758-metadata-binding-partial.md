# DOWNSTREAM NOTICE id:20261122-192758-metadata-binding-partial
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:qc/kagerou/o/20261122-190309-quest-metadata-binding-type-mixed-keys | commit:(this commit)
date: 2026-11-22T19:27:58+09:00
severity: info
checkpoint: metadata-binding-partial
resolves: 20261122-170805-metadata-binding-type-mixed-keys
change: DomainField.metadataBinding (src/lib/domain/types/domainField.ts) is now Readonly<Partial<Record<string, string>>> (was Readonly<Record<string, string>>), so a domain.json whose media fields carry metadataBinding objects with different key sets is assignable to DomainConfig (TS adds the other members' keys as `?: undefined` to JSON-inferred unions → TS2322 before); type only, no runtime change
why: info only; a fork that worked around the TS2322 (a cast, or a temporary permit naming 20261122-170805-metadata-binding-type-mixed-keys) may drop the workaround
required_actions: none
verify: pnpm typecheck
manual_steps: -
refs: src/lib/domain/types/domainField.ts, src/lib/domain/types/domainConfig.test.ts, src/lib/domain/types/mixedMetadataBinding.fixture.json, order 20261122-190309-quest-metadata-binding-type-mixed-keys
notes: code that reads metadataBinding[key] now gets string | undefined (keys were always optional per media kind)
