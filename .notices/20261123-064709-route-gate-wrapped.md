# DOWNSTREAM NOTICE id:20261123-064709-route-gate-wrapped
from: git@github.com:yokouchi-wildweb/next-starter.git | branch:build/20261122-054743-district-concept-foundations.1-routegate | commit:- (this commit)
date: 2026-11-23T06:47:09+09:00
severity: info
checkpoint: route-gate-wrapped
resolves: 20261123-063523-featuregate-route-fork-exceptions
change: the feature-gate route-import check (src/featureGate/checks/routeImports.mjs findOpenRouteImports, run by FEATURE_GATE_CHECK=all pnpm test src/featureGate scripts/structure/proxies) also passes a route file (route.ts / page.tsx / _screen / _components) that asks the gate by the name of the rule owning the domain it imports: gate.enabled("<rule>"), gate.required("<rule>"), useGate().enabled("<rule>"), or <x>.enabled("<rule>") with const <x> = useGate() in the same file (string literal, comments ignored, same file only; helper asksGate(text, ruleName)). No exception table for routes (D22, D54): ROUTE_EXCEPTIONS removed from scripts/structure/proxies/featureGate.test.mjs (its 3 rows ask the gate and pass), findOpenRouteImports takes (rules, routeFiles) only, the shrink-only and rows-exist tests went with the table
why: a fork page that closes itself with gate.enabled / useGate (e.g. a mypage part reading a gated domain) no longer needs a pathPatterns entry that 404s the page, a required/ rule, or an exception receptacle to pass the check
required_actions: none
verify: FEATURE_GATE_CHECK=all pnpm test src/featureGate scripts/structure/proxies passes
manual_steps: -
refs: src/featureGate/checks/routeImports.mjs, src/featureGate/checks/routeImports.test.mjs, src/featureGate/API.md (検査), order 20261123-063523-featuregate-route-fork-exceptions
notes: optional clean-up: a fork that added a pathPatterns entry or a src/featureGate/required/<rule>.ts only to pass this check for a page that closes itself may drop it (the page stays open while the rule is closed, as its own code decides); fork code calling findOpenRouteImports with a third argument drops it | checked on scratch copies of oripa-do 18dffa044's src/app/(user)/(protected)/mypage/_components (loader.ts, DefaultMyPageContent.tsx, MyPageContent.tsx, ProfileCard.tsx) with its rule rankUp: 0 problems (4 with the gate calls removed)
