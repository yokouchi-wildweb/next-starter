// ルート地図の見え方(pnpm check routes -- show の絞り込みと描画)のテスト。
// 入力は手書きの地図 __fixtures__/route-map.sample.jsonl(本物と同じ形の 10 行。ページではないので tsc・next・test:screens は拾わない)。
// 実行: pnpm test src/lib/screens/routeMapView.test.mjs (node:test)
// 設計: src/lib/screens/README.md §13
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { formatRouteDetails, formatRouteMap } from "./routeMap.mjs";
import {
  filterRows,
  matchesAccess,
  normalizeScope,
  parseRouteMapJsonl,
  parseShowArgs,
  renderMermaid,
  renderRouteMap,
  renderTable,
  renderTree,
  shortAccess,
} from "./routeMapView.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = readFileSync(join(here, "__fixtures__/route-map.sample.jsonl"), "utf8");
const rows = parseRouteMapJsonl(FIXTURE);

/** 引数を読んで絞り込んだ行の path(slot 付き) */
const pick = (...argv) => {
  const parsed = parseShowArgs(argv);
  assert.ok(parsed.ok, parsed.error);
  return filterRows(rows, parsed.opts).map((r) => `${r.path}${r.slot ? ` ${r.slot}` : ""}`);
};

test("地図ファイルを読む: 1 行 1 ページ、formatRouteMap に通すと同じ中身(形を変えていない)", () => {
  assert.equal(rows.length, 10);
  assert.equal(formatRouteMap(rows), FIXTURE);
  assert.throws(() => parseRouteMapJsonl('{"path":"/"}\n{oops'), /2 行目/);
});

test("引数: 既定は details・全行、URL 接頭辞は今までどおり 1 つ", () => {
  const parsed = parseShowArgs([]);
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.opts, { prefix: null, view: "details", scopes: [], nearest: false, access: [], states: [], file: null, help: false });
  assert.equal(parseShowArgs(["/admin", "/x"]).ok, false);
});

test("引数の誤りは理由つきで拒む", () => {
  for (const argv of [["--view=graph"], ["--access=admin"], ["--state=on"], ["--scope"], ["--nearest"], ["--help=1"], ["--color=red"]]) {
    const parsed = parseShowArgs(argv);
    assert.equal(parsed.ok, false, argv.join(" "));
    assert.ok(parsed.error.length > 0);
  }
});

test("互換: 引数なし・URL 接頭辞だけは旧 routes:show と同じ(セグメント単位の接頭辞 + details)", () => {
  const parsed = parseShowArgs(["/admin"]);
  assert.ok(parsed.ok);
  const selected = filterRows(rows, parsed.opts);
  const old = rows.filter((r) => r.path === "/admin" || r.path.startsWith("/admin/"));
  assert.equal(renderRouteMap(selected, parsed.opts.view), formatRouteDetails(old));
  assert.equal(renderRouteMap(rows, "details"), formatRouteDetails(rows));
  assert.deepEqual(pick("/admin/"), pick("/admin"));
  assert.deepEqual(pick("/adm"), []);
  assert.equal(pick("/").length, 10);
});

test("--scope: 範囲の 3 つの書き方は同じ、配下の範囲を含む / --nearest は最寄りだけ", () => {
  assert.equal(normalizeScope("src/app/admin/(protected)"), "admin/(protected)");
  assert.equal(normalizeScope("src/app/admin/(protected)/guard.ts"), "admin/(protected)");
  assert.equal(normalizeScope("/admin/(protected)/"), "admin/(protected)");
  for (const root of ["/", "src/app", "root", "src/app/guard.ts"]) assert.equal(normalizeScope(root), "/");
  assert.deepEqual(pick("--scope=admin/(protected)"), ["/admin", "/admin/samples", "/admin/users/general"]);
  assert.deepEqual(pick("--scope=src/app/admin/(protected)", "--nearest"), ["/admin", "/admin/samples"]);
  assert.deepEqual(pick("--scope=/", "--nearest"), ["/", "/admin/login", "/coupons", "/login"]);
  assert.equal(pick("--scope=/").length, 10);
  assert.deepEqual(pick("--scope=admin/insane", "--scope=(user)/(protected)"), ["/admin/insane", "/mypage", "/mypage @modal"]);
});

test("--access: loader の access の値で絞る(同じオプションは OR)", () => {
  assert.deepEqual(pick("--access=public"), ["/", "/admin/login", "/coupons", "/login"]);
  assert.deepEqual(pick("--access=authenticated"), ["/mypage", "/mypage @modal"]);
  assert.deepEqual(pick("--access=role:admin"), ["/admin/insane", "/admin/users/general"]);
  assert.deepEqual(pick("--access=category:admin"), ["/admin"]);
  assert.deepEqual(pick("--access=registry"), ["/admin/samples"]);
  assert.deepEqual(pick("--access=registry:sample"), ["/admin/samples"]);
  assert.deepEqual(pick("--access=registry:sample.search"), ["/admin/samples"]);
  assert.deepEqual(pick("--access=registry:samp"), []);
  assert.deepEqual(pick("--access=statuses"), ["/mypage"]);
  assert.deepEqual(pick("--access=category:admin", "--access=registry"), ["/admin", "/admin/samples"]);
  assert.equal(matchesAccess(undefined, "public"), false);
});

test("--state: verified / gated-off / live", () => {
  assert.equal(pick("--state=verified").length, 10);
  assert.deepEqual(pick("--state=gated-off"), ["/coupons"]);
  assert.equal(pick("--state=live").length, 9);
  assert.equal(pick("--state=gated-off", "--state=live").length, 10);
});

test("別の種類の絞り込みは AND", () => {
  assert.deepEqual(pick("/admin", "--access=public"), ["/admin/login"]);
  assert.deepEqual(pick("--scope=/", "--nearest", "--access=public", "--state=live"), ["/", "/admin/login", "/login"]);
});

test("access の短い表示は --access の言葉", () => {
  assert.equal(shortAccess("public"), "public");
  assert.equal(shortAccess({ roleCategories: ["admin"] }), "category:admin");
  assert.equal(shortAccess({ roleCategories: ["admin"], roles: ["debugger"] }), "category:admin+role:debugger");
  assert.equal(shortAccess({ registry: "sample.search" }), "registry:sample.search");
  assert.equal(shortAccess({ other: 1 }), '{"other":1}');
});

test("tree: URL の木、ページの行に access・最寄りの範囲・止めているか・slot", () => {
  assert.equal(
    renderTree(rows),
    [
      "/  access=public  scope=/",
      "├─ admin  access=category:admin  scope=admin/(protected)",
      "│  ├─ insane  access=role:admin  scope=admin/insane",
      "│  ├─ login  access=public  scope=/",
      "│  ├─ samples  access=registry:sample.search  scope=admin/(protected)",
      "│  └─ users",
      "│     └─ general  access=role:admin  scope=admin/(protected)/users",
      "├─ coupons  access=public  scope=/  [gated-off(/coupons/**)]",
      "├─ login  access=public  scope=/",
      "└─ mypage  access=authenticated  statuses  scope=(user)/(protected)",
      "   mypage @modal  access=authenticated  scope=(user)/(protected)",
      "",
    ].join("\n"),
  );
  // ページの無いルート("/" も)はセグメント名だけ
  assert.equal(renderTree(filterRows(rows, parseShowArgs(["/admin/users"]).opts)), "/\n└─ admin\n   └─ users\n      └─ general  access=role:admin  scope=admin/(protected)/users\n");
});

test("table: Markdown の表(page dir で route group が見える、guard は最寄り → root)", () => {
  const lines = renderTable(rows).trimEnd().split("\n");
  assert.equal(lines[0], "| path | slot | page dir | state | scope | access | guards (nearest → root) |");
  assert.equal(lines[1], "|---|---|---|---|---|---|---|");
  assert.equal(lines.length, 12);
  assert.ok(lines.includes("| /login |  | (user)/(auth)/login | verified | / | public | /: public |"));
  assert.ok(lines.includes("| /coupons |  | (user)/(public)/coupons | verified gated-off(/coupons/**) | / | public | /: public |"));
  assert.ok(lines.includes("| /mypage | @modal | (user)/(protected)/mypage/@modal | verified | (user)/(protected) | authenticated | (user)/(protected): authenticated > /: public |"));
  assert.ok(lines.includes("| /mypage |  | (user)/(protected)/mypage | verified | (user)/(protected) | authenticated +statuses | (user)/(protected): authenticated > /: public |"));
  assert.ok(
    lines.includes(
      "| /admin/users/general |  | admin/(protected)/users/general | verified | admin/(protected)/users | role:admin | admin/(protected)/users: role:admin > admin/(protected): category:admin > /: public |",
    ),
  );
  assert.equal(renderTable([{ ...rows[0], path: "/a|b" }]).includes("/a\\|b"), true, "| は escape する");
});

test("mermaid: guard の範囲を extend の親子で入れ子の subgraph、ページは最寄りの範囲、止めたページは gated", () => {
  const out = renderMermaid(rows);
  const lines = out.trimEnd().split("\n");
  assert.equal(lines[0], "flowchart LR");
  assert.ok(lines.includes("  classDef gated stroke-dasharray: 5 5"));
  const subgraphs = lines.filter((l) => l.trim().startsWith("subgraph"));
  assert.equal(subgraphs.length, 5);
  assert.equal(lines.filter((l) => l.trim() === "end").length, 5);
  // 入れ子の深さ = extend の深さ(root の中に admin/(protected)、その中に users)
  const indentOf = (needle) => lines.find((l) => l.includes(needle)).search(/\S/);
  assert.equal(indentOf('["/ · public"]'), 2);
  assert.equal(indentOf('["admin/(protected) · category:admin"]'), 4);
  assert.equal(indentOf('["admin/(protected)/users · role:admin"]'), 6);
  assert.equal(indentOf('"/admin/users/general<br/>role:admin"'), 8);
  assert.ok(lines.some((l) => l.includes('"/coupons<br/>public<br/>gated-off"]:::gated')));
  assert.ok(lines.some((l) => l.includes('"/mypage @modal<br/>authenticated"]')));
  assert.equal(lines.filter((l) => /^\s*p\d+\[/.test(l)).length, 10, "ページは 1 行 1 箱");
  // 絞り込んだ行だけの範囲を描く(root の外枠は残る)
  const admin = renderMermaid(filterRows(rows, parseShowArgs(["--access=role:admin"]).opts));
  assert.equal(admin.split("\n").filter((l) => l.trim().startsWith("subgraph")).length, 4);
  assert.equal(admin.includes("(user)/(protected)"), false);
  // ラベルの " は Mermaid の #quot; にする
  assert.ok(renderMermaid([{ ...rows[0], path: '/a"b' }]).includes("/a#quot;b"));
});

test("jsonl: 絞った行を地図と同じ形で出す(エージェント向け)、0 件は空", () => {
  const selected = filterRows(rows, parseShowArgs(["--access=public"]).opts);
  assert.equal(renderRouteMap(selected, "jsonl"), formatRouteMap(selected));
  assert.deepEqual(parseRouteMapJsonl(renderRouteMap(selected, "jsonl")), selected);
  assert.equal(renderRouteMap([], "jsonl"), "");
});

test("0 件: tree / table / mermaid は「該当なし」の 1 行、details は今までどおり", () => {
  for (const view of ["tree", "table", "mermaid"]) assert.equal(renderRouteMap([], view), "該当するページはありません\n");
  assert.equal(renderRouteMap([], "details"), formatRouteDetails([]));
});
