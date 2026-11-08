// eslint-rules/required-rules.mjs
//
// 全 Tier の必須の ESLint 規則の一覧(upstream の物)。
// fork の eslint.config.fork.mjs は eslint.config.mjs の最後に読まれるので、ここに載る規則を off / warn にできてしまう。
// pnpm check eslint(scripts/structure/eslint/requiredRules.mjs、pnpm build から呼ぶ)が、fork の設定を含めた最終の設定で
// 各規則が代表のファイルに error のまま掛かっているかを確かめ、外れていれば止める。
//
// - 載せるのは tier で強さが変わらない error の規則だけ(守り・境界の規則)。tier で強さが変わる規則
//   (field-type-guard・core-ui-guards・style-tokens・client-service-boundary)と warn の規則は載せない
// - fork が規則を足す・一覧の外の規則を緩めるのは自由。行ごとの理由付き eslint-disable も今まで通り使える
// - lib の入口の lint(棚の議会 D82)= lib-entry・lib-self-relative(package.json を持つ lib にだけ効くが、設定は全ファイルに掛かる)
// - files = その規則が掛かる代表のファイル(repo 相対)。example: true の行は、upstream にまだ該当ファイルが無い置き場の例
//   (パスで設定を引くので、ファイルが無くても判定できる)

export const REQUIRED_ESLINT_RULES = [
  { rule: "audit/action-naming", files: ["src/features/core/auth/services/server/registration.ts"] },
  { rule: "route-http-export/http-export", files: ["src/app/api/auth/register/route.ts"] },
  { rule: "import-boundaries/route-factory-via-wiring", files: ["src/app/api/auth/register/route.ts", "scripts/operations/deploy/all.ts"] },
  { rule: "import-boundaries/page-guard-via-wiring", files: ["src/app/admin/(protected)/layout.tsx"] },
  { rule: "import-boundaries/cron-route-via-wiring", files: ["src/app/api/cron/audit-log-prune/route.ts"] },
  { rule: "import-boundaries/feature-gate-entries", files: ["src/features/core/auth/services/server/registration.ts"] },
  { rule: "import-boundaries/client-no-domain-json", files: ["src/features/core/auth/hooks/useOAuthSignupFlow.ts"] },
  { rule: "import-boundaries/features-index-no-server-reexport", files: ["src/features/core/auditLog/index.ts"] },
  { rule: "import-boundaries/lib-no-registry", files: ["src/lib/drizzle/index.ts"] },
  { rule: "import-boundaries/lib-no-features", files: ["src/lib/drizzle/index.ts"] },
  { rule: "import-boundaries/src-no-scripts", files: ["src/lib/cron/discover.ts", "src/featureGate/checks/dependencies.test.mjs"] },
  { rule: "import-boundaries/src-no-district-map", files: ["src/lib/districtMap/read.mjs", "src/lib/districtMap/districtMap.test.mjs"] },
  { rule: "import-boundaries/scripts-no-static-wiring", files: ["scripts/runner/task/run.ts", "src/features/sample/scripts/tasks/example.ts", ".notices/20261101-000200-lib-boundaries.crud-entry-split.mjs"], example: true },
  { rule: "import-boundaries/seed-reader", files: ["src/features/sample/components/x.tsx", "scripts/runner/seed/run.ts"], example: true },
  { rule: "import-boundaries/tools-no-db-write", files: ["scripts/operations/features/set.ts", "src/features/sample/scripts/tasks/example.ts", "src/features/sample/seed.ts"], example: true },
  {
    rule: "import-boundaries/lib-entry",
    files: ["src/features/core/auth/services/server/registration.ts", "src/lib/drizzle/index.ts", "scripts/runner/task/run.ts", "eslint.config.mjs"],
  },
  { rule: "import-boundaries/lib-self-relative", files: ["src/lib/drizzle/index.ts"] },
  { rule: "page-authz/layout-no-server-data", files: ["src/app/(user)/layout.tsx", "src/features/core/auth/components/OAuth/index.tsx"] },
  {
    rule: "page-authz/session-api-callsite",
    files: ["src/app/(user)/layout.tsx", "src/features/core/auth/hooks/useOAuthSignupFlow.ts"],
  },
  { rule: "no-server-action/no-server-action", files: ["src/features/core/auth/services/server/registration.ts"] },
  { rule: "core-ui-entry/no-inner-import", files: ["src/app/(user)/layout.tsx", "src/features/core/auth/components/OAuth/index.tsx"] },
  { rule: "realtime-room/purity", files: ["src/features/example/room/reducer.ts"], example: true },
  { rule: "hidden-columns/no-raw-select", files: ["src/features/core/auth/services/server/registration.ts"] },
];
