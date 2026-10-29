// ルート地図(M1)の生成器のテストと、コミットされた地図のずれ検査。
// 実行: pnpm test:route-map (node:test)
//
// fixture はテストの中で仮想のファイル木として組み立てる(ディスクに page.tsx を置くと tsc・next・test:screens が拾うため)。
// 設計: src/lib/screens/README.md §13
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ROUTE_MAP_FILE,
  ROUTE_STATE_LEGACY,
  argsHash,
  buildRouteMap,
  extractGuardCalls,
  formatRouteMap,
  formatSources,
  normalizeArgs,
} from "./routeMap.mjs";
import { discoverRoutes, listAppFiles } from "./routeTree.mjs";
import { featureGateRules } from "../../config/app/feature-gate.config.ts";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

/** 仮想のファイル木(パス → 中身)から buildRouteMap の入力を作る */
function tree(entries) {
  const files = Object.keys(entries);
  return { files, read: (path) => entries[path] ?? "" };
}

const PAGE = `export { XScreen as default } from "./_screen/XScreen";`;
const guardLayout = (args) => `import { authGuard } from "@/features/core/auth/services/server/authorization";
export default async function L({ children }) {
  await authGuard(${args});
  return <>{children}</>;
}`;

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

test("extractGuardCalls: ガード関数の呼び出しを出現順に拾い、import・関数定義・コメントは数えない", () => {
  const src = `import { authGuard } from "x";
// authGuard({ allowRoles: ["nope"] })
export async function authGuard(options) {}
const u = await requireCurrentUser({ behavior: "redirect", redirectTo: "/login" });
const s = await session.getSessionUser();
await authGuard({ allowRoles: ["admin"], redirectTo: "/admin" });`;
  const calls = extractGuardCalls(src);
  assert.deepEqual(
    calls.map((c) => [c.name, c.args]),
    [
      ["requireCurrentUser", '{behavior:"redirect",redirectTo:"/login"}'],
      ["getSessionUser", ""],
      ["authGuard", '{allowRoles:["admin"],redirectTo:"/admin"}'],
    ],
  );
  assert.equal(calls[1].hash, "00000000", "引数なしは 00000000");
});

test("normalizeArgs / argsHash: 空白・改行・末尾カンマ・コメントの違いでは hash が変わらず、中身の変更では変わる", () => {
  const a = extractGuardCalls(`await authGuard({ allowRoles: ["admin"], redirectTo: "/admin" });`)[0];
  const b = extractGuardCalls(`await authGuard({
    // editor は除外
    allowRoles: [
      "admin",
    ],
    redirectTo: "/admin",
  });`)[0];
  assert.equal(a.hash, b.hash);
  const c = extractGuardCalls(`await authGuard({ allowRoles: ["admin", "editor"], redirectTo: "/admin" });`)[0];
  assert.notEqual(a.hash, c.hash);
  assert.equal(normalizeArgs(`{ a: "x  y" }`), `{a:"x  y"}`, "文字列の中の空白は残す");
  assert.match(argsHash("{a:1}"), /^[0-9a-f]{8}$/);
});

test("buildRouteMap: 祖先の layout → loader の順に AND で並べ、ガードの無いページは none(public とは書かない)", () => {
  const input = tree({
    "src/app/layout.tsx": "export default function R({ children }) { return children; }",
    "src/app/(user)/page.tsx": PAGE,
    "src/app/(user)/(protected)/layout.tsx": guardLayout(`{ allowRoles: ["user"], redirectTo: "/login" }`),
    "src/app/(user)/(protected)/mypage/page.tsx": PAGE,
    "src/app/(user)/(protected)/mypage/_screen/loader.ts": `import "server-only";
export const loadMypageScreen = cache(async () => requireCurrentUser({ behavior: "redirect", redirectTo: "/login" }));`,
    "src/app/admin/(protected)/layout.tsx": guardLayout(`{ allowRoles: adminRoles, redirectTo: "/admin/login" }`),
    "src/app/admin/(protected)/users/layout.tsx": guardLayout(`{ allowRoles: ["admin"], redirectTo: "/admin" }`),
    "src/app/admin/(protected)/users/general/page.tsx": PAGE,
    "src/app/admin/(protected)/users/general/_components/loader.ts": `export const loadX = cache(async () => authGuard({ allowRoles: ["admin"] }));`,
  });
  const { rows, problems } = buildRouteMap(input);
  assert.deepEqual(problems, []);
  assert.ok(rows.every((r) => r.state === ROUTE_STATE_LEGACY));
  const line = (key) => formatSources(rows.find((r) => r.key === key).sources);
  assert.equal(line("/"), "none");
  assert.match(line("/mypage"), /^layout:\(user\)\/\(protected\) authGuard#[0-9a-f]{8} > loader:_screen requireCurrentUser#[0-9a-f]{8}$/);
  assert.match(
    line("/admin/users/general"),
    /^layout:admin\/\(protected\) authGuard#\w{8} > layout:admin\/\(protected\)\/users authGuard#\w{8} > loader:_components authGuard#\w{8}$/,
  );
  const text = formatRouteMap(rows);
  assert.equal(/\bpublic\b/.test(text.split("\n").filter((l) => !l.startsWith("#")).join("\n")), false, "行に public と書かない");
});

test("buildRouteMap: @slot の行は親ページと同じ祖先の layout の方針に従う", () => {
  const { rows } = buildRouteMap(
    tree({
      "src/app/(protected)/layout.tsx": guardLayout(`{ allowRoles: ["user"] }`),
      "src/app/(protected)/dashboard/page.tsx": PAGE,
      "src/app/(protected)/dashboard/@stats/page.tsx": PAGE,
    }),
  );
  const parent = formatSources(rows.find((r) => r.key === "/dashboard").sources);
  const slot = formatSources(rows.find((r) => r.key === "/dashboard @stats").sources);
  assert.notEqual(parent, "none");
  assert.equal(slot, parent);
});

test("buildRouteMap: layout のガードの引数を変えると、その配下の全ページの行が変わる(方針の変化が差分に出る)", () => {
  const files = (args) =>
    tree({
      "src/app/debug/layout.tsx": guardLayout(args),
      "src/app/debug/page.tsx": PAGE,
      "src/app/debug/tools/page.tsx": PAGE,
      "src/app/other/page.tsx": PAGE,
    });
  const before = formatRouteMap(buildRouteMap(files(`{ allowRoles: ["admin"] }`)).rows).split("\n");
  const after = formatRouteMap(buildRouteMap(files(`{ allowRoles: ["admin", "debugger"] }`)).rows).split("\n");
  const changed = before.filter((l, i) => l !== after[i]).map((l) => l.split("\t")[0]);
  assert.deepEqual(changed, ["/debug", "/debug/tools"]);
});

test("buildRouteMap: 1 行スイッチの layout はスイッチ先の _layout/<X> のガードを同じ出どころとして拾う(1 段だけ)", () => {
  const { rows } = buildRouteMap(
    tree({
      "src/app/(user)/layout.tsx": `export { AcmeLayout as default } from "./_layout/UserLayout.acme";`,
      "src/app/(user)/_layout/UserLayout.acme.tsx": guardLayout(`{ allowRoles: ["user"] }`),
      "src/app/(user)/page.tsx": PAGE,
      "src/app/plain/layout.tsx": `export { PlainLayout as default } from "./_layout/PlainLayout";`,
      "src/app/plain/_layout/PlainLayout.tsx": "export function PlainLayout({ children }) { return children; }",
      "src/app/plain/page.tsx": PAGE,
      "src/app/missing/layout.tsx": `export { Gone as default } from "./_layout/Gone";`,
      "src/app/missing/page.tsx": PAGE,
    }),
  );
  const line = (key) => formatSources(rows.find((r) => r.key === key).sources);
  assert.match(line("/"), /^layout:\(user\) authGuard#[0-9a-f]{8}$/);
  assert.equal(line("/plain"), "none");
  assert.equal(line("/missing"), "none", "スイッチ先が無ければ layout.tsx の本文だけ");
  const direct = buildRouteMap(
    tree({ "src/app/(user)/layout.tsx": guardLayout(`{ allowRoles: ["user"] }`), "src/app/(user)/page.tsx": PAGE }),
  ).rows;
  assert.equal(line("/"), formatSources(direct[0].sources), "layout.tsx に直接書いたガードと同じ行になる");
});

test("formatRouteMap: ヘッダー + key 順の 1 ページ 1 行で、入力の順序に依らず同じ結果になる", () => {
  const entries = {
    "src/app/b/page.tsx": PAGE,
    "src/app/a/page.tsx": PAGE,
    "src/app/(g)/c/page.tsx": PAGE,
  };
  const forward = formatRouteMap(buildRouteMap(tree(entries)).rows);
  const reversed = formatRouteMap(buildRouteMap(tree(Object.fromEntries(Object.entries(entries).reverse()))).rows);
  assert.equal(forward, reversed);
  const body = forward.split("\n").filter((l) => l && !l.startsWith("#"));
  assert.deepEqual(body, [`/a\t${ROUTE_STATE_LEGACY}\tnone`, `/b\t${ROUTE_STATE_LEGACY}\tnone`, `/c\t${ROUTE_STATE_LEGACY}\tnone`]);
  assert.ok(forward.startsWith("# route-map: generated by `pnpm routes:map`. DO NOT EDIT."));
  assert.ok(forward.endsWith("\n"));
});

test("buildRouteMap: 無効な feature-gate の規則に当たるルートは gated-off。完全一致はその下の fork のページを含まない", () => {
  const entries = {
    "src/app/mypage/page.tsx": PAGE,
    "src/app/mypage/mine/page.tsx": PAGE,
    "src/app/demo/x/page.tsx": PAGE,
    "src/app/wallet/[slug]/page.tsx": PAGE,
  };
  const gateRules = [
    { pathPatterns: ["=/mypage"], enabled: false },
    { pathPatterns: ["/demo"], enabled: false },
    { pathPatterns: ["/wallet"], enabled: true },
  ];
  const { rows } = buildRouteMap({ ...tree(entries), gateRules });
  const state = Object.fromEntries(rows.map((r) => [r.key, r.state]));
  assert.equal(state["/mypage"], "gated-off(=/mypage)");
  assert.equal(state["/mypage/mine"], ROUTE_STATE_LEGACY);
  assert.equal(state["/demo/x"], "gated-off(/demo)");
  assert.equal(state["/wallet/[slug]"], ROUTE_STATE_LEGACY);
});

// ---------------------------------------------------------------------------
// ずれ検査(コミットされた地図 = src/app からの生成結果)
// ---------------------------------------------------------------------------

test(`${ROUTE_MAP_FILE} が src/app からの生成結果と一致する(ずれたら pnpm routes:map で作り直してコミットする)`, () => {
  const read = (rel) => readFileSync(join(repoRoot, rel), "utf8");
  const { rows, problems } = buildRouteMap({ files: listAppFiles(repoRoot), read, gateRules: featureGateRules });
  assert.deepEqual(problems, []);
  const file = join(repoRoot, ROUTE_MAP_FILE);
  assert.ok(existsSync(file), `${ROUTE_MAP_FILE} が無い。pnpm routes:map で生成してコミットする`);
  assert.equal(
    readFileSync(file, "utf8"),
    formatRouteMap(rows),
    `${ROUTE_MAP_FILE} が古い。pnpm routes:map で作り直し、差分(方針の変化)を確かめてコミットする(merge で衝突したときも同じ)`,
  );
});
