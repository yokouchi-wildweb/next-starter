// 管理の枠の部位の data-slot と枠の表の結線の検査。実行: pnpm test:admin-layout
//
// 1. README の data-slot の一覧 = 管理の枠の部品(admin/_layout・(protected)/_layout・insane/_layout)の要素に付く data-slot(両方向)。
//    一覧 = 部位の一覧(src/app/_layout/frame/parts.mjs の管理の枠)、shadcn の部品の data-slot と衝突しない、data-frame-part は残っていない
// 2. 外枠(AdminLayout)は管理の表を共通の読み手 useFrameAttributes に渡し、当たった行の属性が初回の静的描画に入る
// 3. fill の的: 本文の直接の親 [data-admin-main-wrapper] が (protected) と insane にある
// 読み手の行の選び方は src/app/_layout/frame/useFrameAttributes.test.tsx、frame.css の規則と部位の一覧は src/app/_layout/frame のテスト
// (package.json に type: module が無いので tsx は CJS として読む = top-level await・import.meta 不可 → before() で import、__dirname で解決)
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { createElement, type ReactNode } from "react";

const segments: { current: string[] | null } = { current: null };
mock.module("next/navigation", {
  namedExports: { useSelectedLayoutSegments: () => segments.current, usePathname: () => "/admin", useRouter: () => ({ push: () => {} }) },
});

/** 結線を見る表(上流の管理の表は空) */
const TABLE = [
  { pattern: [], scope: "layout", hide: [], fill: false },
  { pattern: ["(protected)", "board", "[id]"], scope: "page", hide: ["admin-footer-pc"], fill: true },
] as const;

const here = (path: string) => pathToFileURL(join(__dirname, path)).href;
mock.module(here("./extensions/frameTable.ts"), { namedExports: { frameTable: TABLE } });
mock.module("@/hooks/useHeaderHeight", { namedExports: { useHeaderHeight: () => 0 } });
mock.module("@/components/Fanctional/DarkModeSwitch", { namedExports: { DarkModeSwitch: () => null } });
mock.module("@/features/core/auth/hooks/useAuthSession", { namedExports: { useAuthSession: () => ({ isAuthenticated: false }) } });

const repo = join(__dirname, "../../../..");
const read = (path: string) => readFileSync(join(repo, path), "utf8");

let render: (node: ReactNode) => string;
let AdminLayout: typeof import("./AdminLayout").AdminLayout;
let parts: typeof import("@/app/_layout/frame");
before(async () => {
  ({ renderToStaticMarkup: render } = await import("react-dom/server"));
  ({ AdminLayout } = await import("./AdminLayout"));
  parts = await import("@/app/_layout/frame");
});

/** 管理の枠の部品のソース(テストを除く .tsx / .ts) */
const FRAME_DIRS = ["src/app/admin/_layout", "src/app/admin/(protected)/_layout", "src/app/admin/insane/_layout"];
const sourcesOf = (dir: string): string[] =>
  readdirSync(join(repo, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "extensions" ? [] : sourcesOf(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
const FRAME_FILES = FRAME_DIRS.flatMap(sourcesOf);

/** ソースの要素に付く data-slot="<名前>"(名前 → 付いているファイル) */
const slotsInSources = () => {
  const found = new Map<string, string[]>();
  for (const file of FRAME_FILES) {
    for (const m of read(file).matchAll(/data-slot="([a-z0-9-]+)"/g)) {
      found.set(m[1], [...(found.get(m[1]) ?? []), relative("src/app/admin", file)]);
    }
  }
  return found;
};

/** README の「data-slot の一覧」の節の名前(行頭 `- \`<名前>\``) */
const slotsInReadme = () => {
  const readme = read("src/app/admin/_layout/README.md");
  const section = /\n## data-slot の一覧\n([\s\S]*?)(\n## |$)/.exec(readme)?.[1];
  assert.ok(section, "README に「## data-slot の一覧」の節が無い");
  return [...section.matchAll(/^- `([a-z0-9-]+)`/gm)].map((m) => m[1]);
};

test("README の data-slot の一覧 = 管理の枠の部品の要素の data-slot(片方にしか無い名前なし)= 部位の一覧の管理の枠", () => {
  const listed = slotsInReadme();
  const found = slotsInSources();
  assert.deepEqual([...listed].sort(), [...found.keys()].sort(), `README ${listed.join(",")} / 要素 ${[...found.keys()].join(",")}`);
  assert.equal(new Set(listed).size, listed.length, "README の一覧に重複");
  const adminSlots = parts.FRAME_SLOTS.filter((s) => s.area === "admin").map((s) => s.name);
  assert.deepEqual([...listed].sort(), [...adminSlots].sort(), "部位の一覧(parts.mjs)の管理の枠と一致しない");
  for (const { slot } of parts.hideableParts("admin")) assert.ok(found.has(slot), `隠せる部位 ${slot} の要素が無い`);
});

test("サイドバーの data-slot は PC の列・SP のドロワーと背景・リサイズのつまみ・SP の開閉ボタンの包みに付く(Button の data-slot は上書きしない)。(protected) と insane の両方", () => {
  const count = (file: string) => read(file).split('data-slot="admin-sidebar"').length - 1;
  for (const [file, n] of [
    ["src/app/admin/(protected)/_layout/Sidebar/PcSidebar.tsx", 1],
    ["src/app/admin/(protected)/_layout/Sidebar/SpSidebar.tsx", 2],
    ["src/app/admin/(protected)/_layout/ResizableArea.tsx", 1],
    ["src/app/admin/(protected)/_layout/AdminProtectedLayout.tsx", 1],
    ["src/app/admin/insane/_layout/InsanePcSidebar.tsx", 1],
    ["src/app/admin/insane/_layout/InsaneSpSidebar.tsx", 2],
    ["src/app/admin/insane/_layout/InsaneResizableArea.tsx", 1],
    ["src/app/admin/insane/_layout/InsaneProtectedLayout.tsx", 1],
  ] as const) {
    assert.equal(count(file), n, `${file} の admin-sidebar`);
  }
  // shadcn の部品の data-slot は上書きしない: 開閉ボタンは display: contents の包みが印を持ち、Button 自身は data-slot を持たない。
  // id はサイドバーを差し替えた fork 向けの橋渡し(どちらか 1 つの layout だけが描く)
  for (const file of ["src/app/admin/(protected)/_layout/AdminProtectedLayout.tsx", "src/app/admin/insane/_layout/InsaneProtectedLayout.tsx"]) {
    const toggle = /<div data-slot="admin-sidebar" className="contents">\s*<Button\s([^>]*)>[\s\S]*?<\/Button>\s*<\/div>/.exec(read(file));
    assert.ok(toggle, `${file}: 開閉ボタンが admin-sidebar の包みの直下に無い`);
    assert.ok(toggle[1].includes('id="admin-sidebar-toggle"'), `${file} の開閉ボタンの id`);
    assert.equal(toggle[1].includes("data-slot"), false, `${file}: Button の data-slot を上書きしている`);
  }
});

test("管理の枠の data-slot は shadcn の部品の data-slot と衝突せず、部位の印 data-frame-part は残っていない", () => {
  const shadcnDir = "src/components/_shadcn";
  const shadcn = new Set(
    sourcesOf(shadcnDir).flatMap((file) => [...read(file).matchAll(/data-slot="([a-z0-9-]+)"/g)].map((m) => m[1])),
  );
  assert.ok(shadcn.has("button"), "shadcn の data-slot を読めていない");
  for (const name of slotsInSources().keys()) assert.equal(shadcn.has(name), false, `${name} は shadcn と衝突`);
  for (const file of FRAME_FILES) assert.equal(read(file).includes("data-frame-part"), false, `${file} に data-frame-part`);
});

test("外枠(AdminLayout)は管理の表を共通の読み手に渡し、当たった行の属性が初回の静的描画に入る(宣言が無ければ data-frame-root だけ)", () => {
  assert.match(read("src/app/admin/_layout/AdminLayout.tsx"), /useFrameAttributes\(frameTable\)/);
  segments.current = ["(protected)", "board", "12"];
  assert.match(
    render(createElement(AdminLayout, null, "CHILD")),
    /style="--app-header-height:0px" data-slot="admin-app-container" data-frame-root="" data-frame-hide="admin-footer-pc" data-frame-fill="">/,
  );
  segments.current = ["(protected)", "users"];
  assert.match(render(createElement(AdminLayout, null, "CHILD")), /data-slot="admin-app-container" data-frame-root="">/);
  segments.current = null;
  assert.match(render(createElement(AdminLayout, null, "CHILD")), /data-frame-root="">/);
});

test("上流は管理の枠の宣言を持たない(表は空)。AdminPage の fill の prop は無く、fill の的(本文の直接の親)は (protected) と insane にある", () => {
  assert.match(read("src/app/admin/_layout/extensions/frameTable.ts"), /export const frameTable = \[\] as const satisfies FrameTable;/);
  assert.equal(read("src/app/admin/_layout/AdminPage.tsx").includes("fill?:"), false);
  assert.ok(read("src/app/admin/(protected)/_layout/ResizableArea.tsx").includes('data-slot="admin-main" data-admin-main-wrapper'));
  assert.ok(read("src/app/admin/insane/_layout/InsaneResizableArea.tsx").includes('data-slot="admin-main" data-admin-main-wrapper=""'));
});
