// ルート地図(src/app/route-map.jsonl)の生成器のテストと、コミットされた地図のずれ検査。
// 鎖(page → Screen → loader → 最寄りの guard.ts → 親 → root)を字面で辿れる行だけが verified、読めない鎖は problems(生成失敗)。
// 実行: pnpm test:route-map (node:test)
//
// fixture はテストの中で仮想のファイル木として組み立てる(ディスクに page.tsx を置くと tsc・next・test:screens が拾うため)。
// 設計: src/lib/screens/README.md §13
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { ROUTE_MAP_FILE, ROUTE_STATE_VERIFIED, buildRouteMap, findNearestGuard, formatRouteMap } from "./routeMap.mjs";
import { parseLiteral } from "./checks.mjs";
import { discoverRoutes, listAppFiles } from "./routeTree.mjs";
import { featureGateRules } from "../../proxies/extensions/featureGateRules.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** 仮想のファイル木(パス → 中身)から buildRouteMap の入力を作る */
function tree(entries) {
  const files = Object.keys(entries);
  return { files, read: (path) => entries[path] ?? "" };
}

// 正常な鎖の部品(仮想のファイル木)
const page = (name) => `export { ${name} as default } from "./_screen/${name}";`;
const screen = (name, loader) => `import type { ScreenProps } from "@/lib/screens/types";
import { ${loader} } from "./loader";

export async function ${name}(props: ScreenProps) {
  const data = await ${loader}(props);
  return <div>{"it's" + JSON.stringify(data)}</div>;
}`;
const loader = (name, guardPath, access) => `import "server-only";
import { createLoader } from "${guardPath}";

export const ${name} = createLoader({
  access: ${access},
  load: async () => ({}),
});`;
const ROOT_GUARD = `import "server-only";
import { defineRootGuard } from "@/wiring/pageGuard";

export const { guard, createLoader, extend } = defineRootGuard({ access: "public" });`;
const childGuard = (parentPath, policy) => `import "server-only";
import { extend as extendParent } from "${parentPath}";

export const { guard, createLoader, extend } = extendParent(${policy});`;
const GUARD_LAYOUT = `import { guard } from "./guard";
export default async function L({ children }) {
  await guard();
  return <>{children}</>;
}`;

/** /x(root の public)と /admin/y(admin 範囲)のページを持つ正常な木 */
function healthyTree(overrides = {}) {
  return tree({
    "src/app/guard.ts": ROOT_GUARD,
    "src/app/x/page.tsx": page("XScreen"),
    "src/app/x/_screen/XScreen.tsx": screen("XScreen", "loadXScreen"),
    "src/app/x/_screen/loader.ts": loader("loadXScreen", "@/app/guard", `"public"`),
    "src/app/admin/guard.ts": childGuard("@/app/guard", `{ access: { roleCategories: ["admin"] }, redirectTo: "/admin/login" }`),
    "src/app/admin/layout.tsx": GUARD_LAYOUT,
    "src/app/admin/y/page.tsx": page("YScreen"),
    "src/app/admin/y/_screen/YScreen.tsx": screen("YScreen", "loadYScreen"),
    "src/app/admin/y/_screen/loader.ts": loader("loadYScreen", "../../guard", `{ roles: ["admin"] }`),
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// 発見(routeTree)
// ---------------------------------------------------------------------------

test("discoverRoutes: group を URL から落とし、`_` のフォルダと api を外し、動的セグメントはそのまま残す", () => {
  const { routes, problems } = discoverRoutes([
    "src/app/layout.tsx",
    "src/app/(user)/page.tsx",
    "src/app/(user)/(protected)/mypage/page.tsx",
    "src/app/(user)/(protected)/wallet/[slug]/page.tsx",
    "src/app/admin/(protected)/page.tsx",
    "src/app/admin/_template/__domains__/page.tsx",
    "src/app/(user)/_screen/page.tsx",
    "src/app/api/foo/page.tsx",
    "src/app/api/foo/route.ts",
    "src/app/store/page.ts",
    "src/app/lab/page.mdx",
    "src/lib/other/page.tsx",
  ]);
  assert.deepEqual(problems, []);
  assert.deepEqual(
    routes.map((r) => [r.key, r.page]),
    [
      ["/", "src/app/(user)/page.tsx"],
      ["/admin", "src/app/admin/(protected)/page.tsx"],
      ["/lab", "src/app/lab/page.mdx"],
      ["/mypage", "src/app/(user)/(protected)/mypage/page.tsx"],
      ["/store", "src/app/store/page.ts"],
      ["/wallet/[slug]", "src/app/(user)/(protected)/wallet/[slug]/page.tsx"],
    ],
  );
});

test("discoverRoutes: @slot のページは外さず、親ページと別の行(key に @slot)になり、親の layout を祖先に持つ", () => {
  const { routes, problems } = discoverRoutes([
    "src/app/layout.tsx",
    "src/app/dashboard/layout.tsx",
    "src/app/dashboard/page.tsx",
    "src/app/dashboard/@analytics/page.tsx",
    "src/app/dashboard/@analytics/layout.tsx",
    "src/app/dashboard/@modal/(.)photo/[id]/page.tsx",
  ]);
  assert.deepEqual(problems, []);
  const byKey = new Map(routes.map((r) => [r.key, r]));
  assert.deepEqual([...byKey.keys()], ["/dashboard", "/dashboard @analytics", "/dashboard/(.)photo/[id] @modal"]);
  assert.deepEqual(byKey.get("/dashboard @analytics").layouts, [
    "src/app/layout.tsx",
    "src/app/dashboard/layout.tsx",
    "src/app/dashboard/@analytics/layout.tsx",
  ]);
  assert.deepEqual(byKey.get("/dashboard @analytics").slots, ["@analytics"]);
});

test("discoverRoutes: 祖先の layout を外側から順に集める(layout の無い段は飛ばす)", () => {
  const { routes } = discoverRoutes([
    "src/app/layout.tsx",
    "src/app/(a)/layout.tsx",
    "src/app/(a)/(b)/(c)/layout.tsx",
    "src/app/(a)/(b)/(c)/x/page.tsx",
  ]);
  assert.deepEqual(routes[0].layouts, ["src/app/layout.tsx", "src/app/(a)/layout.tsx", "src/app/(a)/(b)/(c)/layout.tsx"]);
  assert.equal(routes[0].url, "/x");
});

test("discoverRoutes: 別の group で同じ URL のページが 2 つあれば problems に出る(中間フォルダの共有は可)", () => {
  const ok = discoverRoutes(["src/app/(a)/x/p1/page.tsx", "src/app/(b)/x/p2/page.tsx"]);
  assert.deepEqual(ok.problems, []);
  const dup = discoverRoutes(["src/app/(a)/x/page.tsx", "src/app/(b)/x/page.tsx"]);
  assert.equal(dup.problems.length, 1);
  assert.ok(dup.problems[0].includes("/x"));
});

// ---------------------------------------------------------------------------
// 方針の出どころ(routeMap)
// ---------------------------------------------------------------------------

test("buildRouteMap: 正常な鎖は verified で、段は page → screen → loader → 最寄りの guard → 親 → root の順", () => {
  const { rows, problems } = buildRouteMap(healthyTree());
  assert.deepEqual(problems, []);
  const y = rows.find((r) => r.path === "/admin/y");
  assert.equal(y.state, ROUTE_STATE_VERIFIED);
  assert.deepEqual(
    y.chain.map((s) => [s.kind, s.file]),
    [
      ["page", "src/app/admin/y/page.tsx"],
      ["screen", "src/app/admin/y/_screen/YScreen.tsx"],
      ["loader", "src/app/admin/y/_screen/loader.ts"],
      ["guard", "src/app/admin/guard.ts"],
      ["guard", "src/app/guard.ts"],
    ],
  );
  assert.deepEqual(y.chain[2].access, { roles: ["admin"] });
  assert.deepEqual(y.chain[3].policy, { access: { roleCategories: ["admin"] }, redirectTo: "/admin/login" });
});

test("buildRouteMap: 管理画面の共通部品の組の access は registry:<domain>.<操作>", () => {
  const { rows, problems } = buildRouteMap(
    healthyTree({
      "src/app/admin/y/_screen/loader.ts": `import "server-only";
import type { Sample } from "@/features/sample/entities/model";
import { createLoader } from "@/app/admin/guard";
import { adminListParts } from "@/wiring/domains";
export const loadYScreen = createLoader(adminListParts<Sample>("sample"));`,
    }),
  );
  assert.deepEqual(problems, []);
  assert.deepEqual(rows.find((r) => r.path === "/admin/y").chain[2].access, { registry: "sample.search" });
});

test("buildRouteMap: Screen が loader を呼ばない・最上位で await しないと生成失敗", () => {
  const noCall = buildRouteMap(
    healthyTree({ "src/app/x/_screen/XScreen.tsx": `export function XScreen() { return null; }` }),
  );
  assert.ok(noCall.problems.some((p) => p.includes("/x") && p.includes("loader")));
  const nested = buildRouteMap(
    healthyTree({
      "src/app/x/_screen/XScreen.tsx": `import { loadXScreen } from "./loader";
export async function XScreen(props) {
  if (props.flag) {
    await loadXScreen(props);
  }
  return null;
}`,
    }),
  );
  assert.ok(nested.problems.some((p) => p.includes("最上位")));
  assert.equal(nested.rows.some((r) => r.path === "/x"), false, "読めない行は地図に載せない");
});

test("buildRouteMap: 最寄りでない guard.ts の createLoader は生成失敗", () => {
  const { problems } = buildRouteMap(
    healthyTree({ "src/app/admin/y/_screen/loader.ts": loader("loadYScreen", "@/app/guard", `{ roles: ["admin"] }`) }),
  );
  assert.ok(problems.some((p) => p.includes("最寄りの guard.ts") && p.includes("src/app/admin/guard.ts")));
});

test("buildRouteMap: 字面で読めない access・方針・extend の親は生成失敗", () => {
  const variable = buildRouteMap(
    healthyTree({ "src/app/x/_screen/loader.ts": loader("loadXScreen", "@/app/guard", "ACCESS") }),
  );
  assert.ok(variable.problems.some((p) => p.includes("access が字面で読めない")));
  const policy = buildRouteMap(healthyTree({ "src/app/admin/guard.ts": childGuard("@/app/guard", "ADMIN_POLICY") }));
  assert.ok(policy.problems.some((p) => p.includes("方針が字面のオブジェクトでない")));
  const parent = buildRouteMap(healthyTree({ "src/app/admin/guard.ts": childGuard("@/app/nowhere", `{ access: "authenticated" }`) }));
  assert.ok(parent.problems.some((p) => p.includes("extend の親")));
});

test("buildRouteMap: guard.ts の範囲の layout が guard() を呼ばない・旧ガードを直接呼ぶと生成失敗", () => {
  const missing = buildRouteMap(
    healthyTree({ "src/app/admin/layout.tsx": `export default function L({ children }) { return children; }` }),
  );
  assert.ok(missing.problems.some((p) => p.includes("guard() を呼んでいない")));
  const legacy = buildRouteMap(
    healthyTree({
      "src/app/admin/layout.tsx": `import { guard } from "./guard";
import { authGuard } from "@/features/core/auth/services/server/authorization";
export default async function L({ children }) {
  await guard();
  await authGuard({ allowRoles: ["admin"] });
  return children;
}`,
    }),
  );
  assert.ok(legacy.problems.some((p) => p.includes("authGuard")));
});

test("buildRouteMap: 無効な feature-gate の規則に当たるルートは gatedOff に最初のパターン(鎖は verified 必須)", () => {
  const { rows } = buildRouteMap({ ...healthyTree(), gateRules: [{ pathPatterns: ["/admin", "/api/admin"], enabled: () => false }] });
  assert.equal(rows.find((r) => r.path === "/admin/y").gatedOff, "/admin");
  assert.equal(rows.find((r) => r.path === "/x").gatedOff, null);
});

test("formatRouteMap: 1 行 1 JSON、キーの順は固定、行は path 順で入力の順序に依らない", () => {
  const forward = formatRouteMap(buildRouteMap(healthyTree()).rows);
  const entries = Object.entries({ ...healthyTree().files.reduce((acc, f) => ({ ...acc, [f]: healthyTree().read(f) }), {}) }).reverse();
  const reversed = formatRouteMap(buildRouteMap(tree(Object.fromEntries(entries))).rows);
  assert.equal(forward, reversed);
  const lines = forward.trim().split("\n");
  assert.deepEqual(lines.map((l) => JSON.parse(l).path), ["/admin/y", "/x"]);
  assert.deepEqual(Object.keys(JSON.parse(lines[0])), ["path", "slot", "state", "gatedOff", "chain"]);
  assert.ok(forward.endsWith("\n"));
});

test("findNearestGuard: ページの dir から上へ最初の guard.ts", () => {
  const files = new Set(["src/app/guard.ts", "src/app/admin/guard.ts"]);
  assert.equal(findNearestGuard("src/app/admin/y/z", files), "src/app/admin/guard.ts");
  assert.equal(findNearestGuard("src/app/x", files), "src/app/guard.ts");
  assert.equal(findNearestGuard("src/app", files), "src/app/guard.ts");
});

test("parseLiteral: 字面のオブジェクト・配列・文字列を読み、識別子や呼び出しは expr にする", () => {
  assert.deepEqual(parseLiteral(`{ access: { roles: ["admin"], }, returnBack: true, n: 1, s: 'x' }`), {
    access: { roles: ["admin"] },
    returnBack: true,
    n: 1,
    s: "x",
  });
  assert.deepEqual(parseLiteral(`{ allowStatuses: USER_STATUSES, load: async () => ({}) }`), {
    allowStatuses: { expr: "USER_STATUSES" },
    load: { expr: "async () => ({})" },
  });
  assert.deepEqual(parseLiteral(`{ ...base }`), { expr: "{ ...base }" });
});

// ---------------------------------------------------------------------------
// ずれ検査(コミットされた地図 = src/app からの生成結果)
// ---------------------------------------------------------------------------

test(`${ROUTE_MAP_FILE} が src/app からの生成結果と一致し、全行が verified(ずれたら pnpm routes:map で作り直してコミットする)`, () => {
  const read = (rel) => readFileSync(join(repoRoot, rel), "utf8");
  const { rows, problems } = buildRouteMap({ files: listAppFiles(repoRoot), read, gateRules: featureGateRules });
  assert.deepEqual(problems, [], "鎖が読めないページがある(pnpm routes:map が行と理由を出す)");
  assert.ok(rows.every((r) => r.state === ROUTE_STATE_VERIFIED));
  const file = join(repoRoot, ROUTE_MAP_FILE);
  assert.ok(existsSync(file), `${ROUTE_MAP_FILE} が無い。pnpm routes:map で生成してコミットする`);
  assert.equal(
    readFileSync(file, "utf8"),
    formatRouteMap(rows),
    `${ROUTE_MAP_FILE} が古い。pnpm routes:map で作り直し、差分(方針の変化)を確かめてコミットする(merge で衝突したときも同じ)`,
  );
});
