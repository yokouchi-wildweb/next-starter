// 孤立の検査(1 つ、./orphans.mjs)と宣言に無い鍵の検査(./overrideKeys.mjs)を、pnpm check extensions の入口 planExtensions で通す
// 実行: pnpm test scripts/structure/extensions/orphans.test.mjs
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import { planExtensions } from "./extensions.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const real = (path) => readFileSync(join(repoRoot, path), "utf8");
// 上書きの対象の点の宣言は実リポの物(鍵の集合・glob を写さない)
const DECLARATIONS = ["src/features/core/user/extensionPoints.ts", "src/features/core/userProfile/extensionPoints.ts", "src/lib/cron/extensionPoints.ts", "src/lib/domain/extensionPoints.ts", "src/features/core/admin/extensionPoints.ts"];

/** fork(acme)の一時リポ */
function fixture(files) {
  const root = mkdtempSync(join(tmpdir(), "orphans-"));
  const put = (path, text) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  put("repo.json", '{"repo_id": "acme", "tier": "leaf"}\n');
  put(".notices/applied/parent.md", "");
  put("src/lib/CATALOG.md", "## next-starter\n\n## parent\n\n## acme\n");
  for (const path of DECLARATIONS) put(path, real(path));
  for (const [path, text] of Object.entries(files)) put(path, text);
  return root;
}
const problemsOf = (files) => planExtensions(fixture(files)).problems;
const ENTRY = 'export const domainEntries = { user: { service: async () => ({}), access: {} } };\n';

test("通る: fork の今の上書きの形(core ロール・ロール・プロフィール・cron・domainEntry・受け口)と空の上書き", () => {
  const problems = problemsOf({
    "src/features/core/user/coreRoles/user.role.json": "{}\n",
    "src/features/core/user/coreRoles/user.role.override.ts": 'import type { CoreRoleOverride } from "../types";\n\nexport const override: CoreRoleOverride = { hasProfile: true };\n',
    "src/features/core/user/roles/editor.role.json": "{}\n",
    "src/features/core/user/roles/editor.role.override.ts": "export const override = { enabled: false };\n",
    "src/features/core/userProfile/profiles/user.profile.json": "{}\n",
    "src/features/core/userProfile/profiles/user.profile.override.ts": 'export const override = { searchFields: ["nick"] };\n',
    "src/app/api/cron/wallet-expire-lots/task.ts": "export const cronTask = {};\n",
    "src/app/api/cron/wallet-expire-lots/task.override.ts": 'import type { CronTaskOverride } from "@/lib/cron";\n\nexport const cronOverride: CronTaskOverride = {\n  disabled: true,\n};\n',
    "src/app/api/cron/other/task.ts": "export const cronTask = {};\n",
    "src/app/api/cron/other/task.override.ts": "// 親の上書きを外す\n",
    "src/features/core/user/services/server/domainEntry.ts": ENTRY,
    "src/features/core/user/services/server/domainEntry.override.ts": "export const domainEntryOverrides = { user: PUBLIC_READ } satisfies DomainEntryOverrides;\n",
    "src/features/core/admin/menu/items/users.ts": 'export const item = { key: "users" };\n',
    "src/features/core/admin/menu/items/users.override.ts": "export const override = { hidden: true };\n",
  });
  assert.deepEqual(problems, []);
});

test("孤立した .override: 受ける点が無い・点はあるが対象が無い(cron・ロール・domainEntry)", () => {
  const problems = problemsOf({
    "src/features/core/x/thing.tsx": "export const x = 1;\n",
    "src/features/core/x/thing.override.tsx": "export const override = {};\n",
    "src/app/api/cron/gone/task.override.ts": "export const cronOverride = { disabled: true };\n",
    "src/features/core/user/roles/user.role.override.ts": "export const override = {};\n",
    "src/features/core/lonely/services/server/domainEntry.override.ts": "export const domainEntryOverrides = {};\n",
  });
  const of = (path) => problems.find((p) => p.startsWith(`${path}:`)) ?? "";
  assert.match(of("src/features/core/x/thing.override.tsx"), /この上書きを受ける点が無い/);
  assert.match(of("src/features/core/user/roles/user.role.override.ts"), /隣に上書きの対象 user\.role\.json が無い/);
  assert.match(of("src/features/core/lonely/services/server/domainEntry.override.ts"), /隣に上書きの対象 domainEntry\.ts が無い/);
  // cron のフォルダに task.ts が無いのはフォルダの形の誤りとして src/lib/cron/discover.ts も止める。孤立の検査は上書きとして止める
  assert.match(of("src/app/api/cron/gone/task.override.ts"), /隣に上書きの対象 task\.ts が無い/);
});

test("宣言に無い鍵: core ロールの enabled・プロフィールの fields・cron の未知の鍵・domainEntry の無いキー(pnpm check extensions = build でも止まる)", () => {
  const problems = problemsOf({
    "src/features/core/user/coreRoles/user.role.json": "{}\n",
    "src/features/core/user/coreRoles/user.role.override.ts": "export const override = { enabled: false };\n",
    "src/features/core/userProfile/profiles/user.profile.json": "{}\n",
    "src/features/core/userProfile/profiles/user.profile.override.ts": "export const override = { fields: [] };\n",
    "src/app/api/cron/a/task.ts": "export const cronTask = {};\n",
    "src/app/api/cron/a/task.override.ts": "export const cronOverride = { run: 1 };\n",
    "src/features/core/user/services/server/domainEntry.ts": ENTRY,
    "src/features/core/user/services/server/domainEntry.override.ts": "export const domainEntryOverrides = { nope: {} };\n",
  });
  const of = (path) => problems.find((p) => p.startsWith(`${path}:`)) ?? "";
  assert.match(of("src/features/core/user/coreRoles/user.role.override.ts"), /enabled は上書きできない\(できるのは label・hasProfile/);
  assert.match(of("src/features/core/userProfile/profiles/user.profile.override.ts"), /fields は上書きできない/);
  assert.match(of("src/app/api/cron/a/task.override.ts"), /run は上書きできない\(できるのは schedule・disabled/);
  assert.match(of("src/features/core/user/services/server/domainEntry.override.ts"), /キー nope は隣の domainEntry\.ts の domainEntries に無い/);
});

test(".replace: boardgame-site の 5 本の形(枠の中の部品の .replace)は既定の無い所で止まり、スイッチの向け先と .default の隣と 1 行スイッチは通る", () => {
  const P = "export const X = 1;\n";
  const problems = problemsOf({
    "src/app/(user)/layout.tsx": 'export { UserLayout as default } from "./_layout/UserLayout.replace";\n',
    "src/app/(user)/_layout/UserLayout.tsx": P,
    "src/app/(user)/_layout/UserLayout.replace.tsx": P,
    "src/app/(user)/_layout/BottomNav/index.tsx": P,
    "src/app/(user)/_layout/BottomNav/index.replace.tsx": P,
    "src/app/(user)/_layout/BottomNav/BottomNavItem.tsx": P,
    "src/app/(user)/_layout/BottomNav/BottomNavItem.replace.tsx": P,
    "src/app/(user)/_layout/BottomNav/BottomNavSpacer.tsx": P,
    "src/app/(user)/_layout/BottomNav/BottomNavSpacer.replace.tsx": P,
    "src/app/(user)/_layout/BottomNav/useBottomNavItems.ts": P,
    "src/app/(user)/_layout/BottomNav/useBottomNavItems.replace.ts": P,
    "src/app/(user)/_layout/Header/index.tsx": P,
    "src/app/(user)/_layout/Header/index.replace.tsx": P,
    "src/app/(user)/_components/BottomNavItem.tsx": P,
    "src/features/core/payment/enricher.default.ts": P,
    "src/features/core/payment/enricher.ts": 'export * from "./enricher.replace";\n',
    "src/features/core/payment/enricher.replace.ts": P,
    "src/features/core/h/only.replace.ts": P,
  });
  const replaces = problems.filter((p) => p.includes(".replace"));
  assert.deepEqual(replaces.map((p) => p.split(":")[0]), [
    "src/app/(user)/_layout/BottomNav/BottomNavItem.replace.tsx",
    "src/app/(user)/_layout/BottomNav/BottomNavSpacer.replace.tsx",
    "src/app/(user)/_layout/BottomNav/index.replace.tsx",
    "src/app/(user)/_layout/BottomNav/useBottomNavItems.replace.ts",
    "src/app/(user)/_layout/Header/index.replace.tsx",
    "src/features/core/h/only.replace.ts",
  ]);
  assert.ok(replaces.slice(0, 5).every((p) => p.includes("_components/ に印なしの名前で置き")));
  assert.match(replaces[5], /隣に既定 only\.default\.ts\(x\) が無い/);
});

test("ForkProviders を書き換えた fork(中身を書いたスイッチ)は 1 行スイッチの検査で止まる(中身は ForkProviders.replace.tsx へ)", () => {
  const problems = problemsOf({
    "src/app/_providers/ForkProviders.default.tsx": "export function ForkProviders() { return null; }\n",
    "src/app/_providers/ForkProviders.tsx": 'import type { ReactNode } from "react";\nexport function ForkProviders({ children }: { children: ReactNode }) { return children; }\n',
  });
  assert.ok(problems.some((p) => p.startsWith("src/app/_providers/ForkProviders.tsx:") && p.includes("re-export 1 文だけ")), problems.join("\n"));
  assert.deepEqual(
    problemsOf({
      "src/app/_providers/ForkProviders.default.tsx": "export function ForkProviders() { return null; }\n",
      "src/app/_providers/ForkProviders.tsx": 'export { ForkProviders } from "./ForkProviders.replace";\n',
      "src/app/_providers/ForkProviders.replace.tsx": "export function ForkProviders() { return null; }\n",
    }),
    [],
  );
});
