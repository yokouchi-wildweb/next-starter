# DOWNSTREAM NOTICE id:20261111-122528-feature-report-dependency-exceptions
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:qc/akatsuki/o/20261110-142113-feature-report-dependency-exceptions | commit:- (this commit)
date: 2026-11-11T12:25:28+09:00
severity: info
checkpoint: feature-report-dependency-exceptions
fixes: 20261105-112509-feature-gate-automation
resolves: 20261110-142113-feature-report-dependency-exceptions
change: readFeatureReport (@/featureGate/node) reads the dependencyExceptions/ receptacle by default, so pnpm ops features list and gateTools.test.ts count exceptions the same way as the dependency check; scripts/operations/features/list.ts no longer passes them
why: the dependency check passed a file through its dependencyExceptions/ entry while readFeatureReport called without exceptions marked it unallowed, so a fork with an exception always failed gateTools.test.ts
required_actions: none
verify: pnpm test src/featureGate/checks/gateTools.test.ts passes with your src/featureGate/dependencyExceptions/*.ts entries; pnpm ops features list shows those files as allowed by exception
manual_steps: -
refs: src/featureGate/node/describe.ts (readFeatureReport), src/featureGate/checks/dependencies.mjs (scanDependencies), scripts/operations/features/list.ts
notes: the third argument exceptionFiles stays (pass it only to override in tests). A fork that edited gateTools.test.ts or describe.ts locally to pass may return them to upstream's text
