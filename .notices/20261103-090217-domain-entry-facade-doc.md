# DOWNSTREAM NOTICE id:20261103-090217-domain-entry-facade-doc
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:feature/bundle3-ui-docs-tools | commit:- (this commit)
date: 2026-11-03T09:02:17+09:00
severity: info
checkpoint: domain-entry-facade-doc
resolves: 20261026-070040-domain-entry-facade-service-doc
change: src/lib/domain/README.md (domainEntry.ts form) now states the facade rule: a service exposing only part of the base (read-only etc.) fails test:service-registry (getTableName / getIdColumnName / truncateAll / searchWithDeleted required on Drizzle entries) → domainEntry `service` points at the base like core auditLogFailed; the registry then hands the whole base to every consumer, so access stays INTERNAL_ONLY or opens only what the whole base may do
why: forks with facade services hit the test failure without guidance (reported by oripa-do prizeExchange)
required_actions: none
verify: pnpm test:service-registry
manual_steps: -
refs: src/lib/domain/README.md「定義ファイル: services/server/domainEntry.ts」 | src/features/core/auditLog/services/server/domainEntry.ts | scripts/registry/serviceRegistry/serviceRegistry.test.mjs
notes: doc only, no behavior change. oripa-do's exchangeTransaction entry (base + INTERNAL_ONLY) already follows it
