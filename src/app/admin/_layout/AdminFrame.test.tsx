// 管理の枠の宣言の読み手と、隠す・fill の CSS(手書き)の検査。実行: pnpm test:admin-layout
//
// 1. src/styles/_base/frame.css の管理の隠す規則 = 管理の隠せる部位(src/app/_layout/frame/parts.mjs)× 端末、過不足なし。:has() は使わない
// 2. 規則の狙う先(id と data-frame-part="admin-*")が既定の枠部品に実在し、外枠(AdminLayout)に data-frame-root がある
// 3. 読み手 useAdminFrame は今の segments に当たる表の行を外枠の属性(data-frame-hide / data-frame-fill)にする(初回の静的描画に入る)
// 4. fill の規則はメイン領域のラッパーを束縛モードにし、直下の #main を前の <AdminPage fill> と同じ形にする
// 表はモック(上流の表は空)。照合そのものは src/app/_layout/frame/resolve.test.mjs
// (package.json に type: module が無いので tsx は CJS として読む = top-level await・import.meta 不可 → before() で import、__dirname で解決)
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createElement, type ReactNode } from "react";

const segments: { current: string[] | null } = { current: null };
mock.module("next/navigation", {
  namedExports: { useSelectedLayoutSegments: () => segments.current, usePathname: () => "/admin", useRouter: () => ({ push: () => {} }) },
});

/** 読み手の行の選び方を見る表(layout の行・page の行・動的な段・静的な兄弟) */
const TABLE = [
  { pattern: [], scope: "layout", hide: [], fill: false },
  { pattern: ["(protected)", "kiosk"], scope: "layout", hide: ["admin-sidebar-sp", "admin-sidebar-pc", "admin-footer-sp", "admin-footer-pc"], fill: false },
  { pattern: ["(protected)", "board", "[id]"], scope: "page", hide: ["admin-footer-pc"], fill: true },
  { pattern: ["(protected)", "board", "new"], scope: "page", hide: [], fill: false },
] as const;

const here = (path: string) => pathToFileURL(join(__dirname, path)).href;
mock.module(here("./extensions/frameTable.ts"), { namedExports: { frameTable: TABLE } });
mock.module("@/hooks/useHeaderHeight", { namedExports: { useHeaderHeight: () => 0 } });
mock.module("@/components/Fanctional/DarkModeSwitch", { namedExports: { DarkModeSwitch: () => null } });
mock.module("@/features/core/auth/hooks/useAuthSession", { namedExports: { useAuthSession: () => ({ isAuthenticated: false }) } });

const repo = join(__dirname, "../../../..");
const read = (path: string) => readFileSync(join(repo, path), "utf8");
const CSS_PATH = "src/styles/_base/frame.css";

let render: (node: ReactNode) => string;
let useAdminFrame: typeof import("./hooks/useAdminFrame").useAdminFrame;
let AdminLayout: typeof import("./AdminLayout").AdminLayout;
let parts: typeof import("@/app/_layout/frame");
before(async () => {
  ({ renderToStaticMarkup: render } = await import("react-dom/server"));
  ({ useAdminFrame } = await import("./hooks/useAdminFrame"));
  ({ AdminLayout } = await import("./AdminLayout"));
  parts = await import("@/app/_layout/frame");
});

/** CSS の規則(セレクタ → 宣言)。コメントを除き、@media の中も平らに読む */
const rulesOf = (css: string) => {
  const body = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: { media: string | null; selector: string; decl: string }[] = [];
  let media: string | null = null;
  for (const m of body.matchAll(/(@media[^{]+)\{|([^{}]+)\{([^{}]*)\}|\}/g)) {
    if (m[1]) media = m[1].trim();
    else if (m[2]) rules.push({ media, selector: m[2].trim(), decl: m[3].trim().replace(/\s+/g, " ") });
    else media = null;
  }
  return rules;
};

const MEDIA = { sp: "@media (width < 40rem)", pc: "@media (width >= 40rem)" } as const;
const ADMIN_TOKEN = /\[data-frame-hide~="(admin-[^"]+)"\]/;

test("frame.css の管理の隠す規則は管理の隠せる部位 × 端末とちょうど一致する(足りない・余る規則なし、:has() なし)", () => {
  const css = read(CSS_PATH);
  assert.equal(css.includes(":has("), false, "子が親を変える :has() は使わない");
  const hides = rulesOf(css).filter((r) => r.decl.startsWith("display: none") && ADMIN_TOKEN.test(r.selector));
  const expected = parts.hideableParts("admin").flatMap(({ slot }) => parts.FRAME_DEVICES.map((device) => `${slot}-${device}`));
  assert.deepEqual(expected.length, 6);
  const found = hides.map((r) => ADMIN_TOKEN.exec(r.selector)![1]);
  assert.deepEqual([...found].sort(), [...expected].sort());
  for (const rule of hides) {
    const token = ADMIN_TOKEN.exec(rule.selector)![1];
    const device = token.endsWith("-sp") ? "sp" : "pc";
    const slot = token.slice(0, -3);
    assert.equal(rule.media, MEDIA[device], `${token} は ${MEDIA[device]} の中`);
    assert.ok(rule.selector.startsWith(`[data-frame-root][data-frame-hide~="${token}"] :is(`), `${token} は外枠の属性から狙う`);
    assert.ok(rule.selector.includes(`[data-frame-part~="${slot}"]`), `${token} は data-frame-part="${slot}" も狙う`);
  }
});

test("規則の狙う先(id と data-frame-part)が既定の枠部品に実在し、外枠に data-frame-root がある", () => {
  const files = [
    "src/app/admin/_layout/Header.tsx",
    "src/app/admin/(protected)/_layout/Footer.tsx",
    "src/app/admin/(protected)/_layout/Sidebar/PcSidebar.tsx",
    "src/app/admin/(protected)/_layout/Sidebar/SpSidebar.tsx",
    "src/app/admin/(protected)/_layout/ResizableArea.tsx",
    "src/app/admin/(protected)/_layout/AdminProtectedLayout.tsx",
    "src/app/admin/insane/_layout/InsanePcSidebar.tsx",
    "src/app/admin/insane/_layout/InsaneSpSidebar.tsx",
    "src/app/admin/insane/_layout/InsaneResizableArea.tsx",
    "src/app/admin/insane/_layout/InsaneProtectedLayout.tsx",
  ];
  const source = (file: string) => read(file);
  for (const { slot } of parts.hideableParts("admin")) {
    assert.ok(files.some((file) => source(file).includes(`data-frame-part="${slot}"`)), `data-frame-part="${slot}" の部品が無い`);
  }
  // サイドバーの印はサイドバーに付く物の全部(PC の列・SP のドロワーと背景・リサイズのつまみ・SP の開閉ボタン)。(protected) と insane の両方
  const sidebarMarks = (file: string) => source(file).split('data-frame-part="admin-sidebar"').length - 1;
  for (const [file, count] of [
    ["src/app/admin/(protected)/_layout/Sidebar/PcSidebar.tsx", 1],
    ["src/app/admin/(protected)/_layout/Sidebar/SpSidebar.tsx", 2],
    ["src/app/admin/(protected)/_layout/ResizableArea.tsx", 1],
    ["src/app/admin/(protected)/_layout/AdminProtectedLayout.tsx", 1],
    ["src/app/admin/insane/_layout/InsanePcSidebar.tsx", 1],
    ["src/app/admin/insane/_layout/InsaneSpSidebar.tsx", 2],
    ["src/app/admin/insane/_layout/InsaneResizableArea.tsx", 1],
    ["src/app/admin/insane/_layout/InsaneProtectedLayout.tsx", 1],
  ] as const) {
    assert.equal(sidebarMarks(file), count, `${file} の admin-sidebar の印`);
  }
  const all = files.map(source).join("\n") + read("src/components/AppFrames/constants.ts");
  const adminCss = rulesOf(read(CSS_PATH)).filter((r) => ADMIN_TOKEN.test(r.selector)).map((r) => r.selector).join("\n");
  for (const id of new Set([...adminCss.matchAll(/#([a-z-]+)/g)].map((m) => m[1]))) {
    assert.ok(all.includes(`"${id}"`), `#${id} の部品が無い`);
  }
  assert.ok(read("src/app/admin/_layout/AdminLayout.tsx").includes('data-frame-root=""'));
});

const Probe = () => createElement("x-frame", useAdminFrame());
const attrsAt = (current: string[] | null) => {
  segments.current = current;
  return render(createElement(Probe));
};

test("useAdminFrame は今の segments に当たる表の行を属性にする(layout の行・page の行・静的な兄弟、当たらなければ根の行)", () => {
  assert.equal(attrsAt(["(protected)", "kiosk", "a", "b"]), '<x-frame data-frame-hide="admin-sidebar-sp admin-sidebar-pc admin-footer-sp admin-footer-pc"></x-frame>');
  assert.equal(attrsAt(["(protected)", "board", "12"]), '<x-frame data-frame-hide="admin-footer-pc" data-frame-fill=""></x-frame>');
  assert.equal(attrsAt(["(protected)", "board", "new"]), "<x-frame></x-frame>", "静的な兄弟は動的な段の宣言に当たらない");
  assert.equal(attrsAt(["(protected)", "board", "12", "edit"]), "<x-frame></x-frame>", "page の行は子のルートに継がない");
  assert.equal(attrsAt(["(protected)", "users"]), "<x-frame></x-frame>");
  // app router の外(null)は segments = [] と同じ
  assert.equal(attrsAt(null), attrsAt([]));
});

test("属性は外枠(AdminLayout)の初回の静的描画に入り、宣言が無ければ data-frame-root だけ", () => {
  segments.current = ["(protected)", "board", "12"];
  const html = render(createElement(AdminLayout, null, "CHILD"));
  assert.match(html, /<div class="relative flex [^"]+" style="--app-header-height:0px" data-frame-root="" data-frame-hide="admin-footer-pc" data-frame-fill="">/);
  segments.current = ["(protected)", "users"];
  assert.match(render(createElement(AdminLayout, null, "CHILD")), /style="--app-header-height:0px" data-frame-root="">/);
});

test("上流は管理の枠の宣言を持たない(表は空)。AdminPage の fill の prop と :has() の fill の規則は無い", () => {
  assert.match(read("src/app/admin/_layout/extensions/frameTable.ts"), /export const frameTable = \[\] as const satisfies FrameTable;/);
  assert.equal(read("src/app/admin/_layout/AdminPage.tsx").includes("fill?:"), false);
  assert.equal(read("src/styles/_base/config.css").includes("data-admin-fill"), false);
});

test("fill の規則: メイン領域のラッパーを束縛モードにし、直下の #main を前の <AdminPage fill> と同じ形(flex-1 min-h-0 flex-col + 余白トークン)にする", () => {
  const rules = rulesOf(read(CSS_PATH));
  const wrapper = rules.find((r) => r.selector === "[data-frame-root][data-frame-fill] [data-admin-main-wrapper]");
  assert.ok(wrapper && wrapper.media === null, "ラッパーの規則が無い");
  assert.equal(wrapper.decl, "display: flex; flex-direction: column; min-height: 0;");
  const main = rules.find((r) => r.selector === "[data-frame-root][data-frame-fill] [data-admin-main-wrapper] > #main");
  assert.ok(main && main.media === null, "本文の規則が無い");
  assert.equal(
    main.decl,
    "display: flex; flex: 1; flex-direction: column; min-height: 0; padding-block: var(--admin-page-padding-block); padding-inline: var(--admin-page-padding-inline);",
  );
  // 本文の直接の親 = ラッパー((protected) の ResizableArea・insane の InsaneResizableArea)
  assert.ok(read("src/app/admin/(protected)/_layout/ResizableArea.tsx").includes("<div data-admin-main-wrapper"));
  assert.ok(read("src/app/admin/insane/_layout/InsaneResizableArea.tsx").includes('<div data-admin-main-wrapper=""'));
});
