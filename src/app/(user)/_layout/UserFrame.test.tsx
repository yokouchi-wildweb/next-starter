// 利用者の枠の宣言の読み手と、隠す CSS(手書き)の検査。実行: pnpm test:user-layout
//
// 1. src/styles/_base/frame.css の隠す規則 = 隠せる部位(src/app/_layout/frame/parts.mjs)× 端末、過不足なし。:has() は使わない
// 2. 規則の狙う先(id と data-frame-part)が既定の枠部品に実在し、外枠に data-frame-root がある
// 3. 読み手 useUserFrame は今の segments に当たる表の行を外枠の属性(data-frame-hide / data-frame-fill)にする
// (package.json に type: module が無いので tsx は CJS として読む = top-level await・import.meta 不可 → before() で import、__dirname で解決)
import { before, mock, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ReactNode } from "react";

const segments: { current: string[] | null } = { current: null };
mock.module("next/navigation", {
  namedExports: { useSelectedLayoutSegments: () => segments.current, usePathname: () => "/", useRouter: () => ({ push: () => {} }) },
});

const repo = join(__dirname, "../../../..");
const read = (path: string) => readFileSync(join(repo, path), "utf8");
const CSS_PATH = "src/styles/_base/frame.css";

let render: (node: ReactNode) => string;
let useUserFrame: typeof import("./hooks/useUserFrame").useUserFrame;
let parts: typeof import("@/app/_layout/frame");
let frameTable: typeof import("./extensions/frameTable").frameTable;
before(async () => {
  ({ renderToStaticMarkup: render } = await import("react-dom/server"));
  ({ useUserFrame } = await import("./hooks/useUserFrame"));
  parts = await import("@/app/_layout/frame");
  ({ frameTable } = await import("./extensions/frameTable"));
});

/** CSS の規則(セレクタ → 宣言)。コメントを除き、@media の中も平らに読む */
const rulesOf = (css: string) => {
  const body = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules: { media: string | null; selector: string; decl: string }[] = [];
  let media: string | null = null;
  for (const m of body.matchAll(/(@media[^{]+)\{|([^{}]+)\{([^{}]*)\}|\}/g)) {
    if (m[1]) media = m[1].trim();
    else if (m[2]) rules.push({ media, selector: m[2].trim(), decl: m[3].trim() });
    else media = null;
  }
  return rules;
};

const MEDIA = { sp: "@media (width < 40rem)", pc: "@media (width >= 40rem)" } as const;

test("frame.css の隠す規則は隠せる部位 × 端末とちょうど一致する(足りない・余る規則なし、:has() なし)", () => {
  const css = read(CSS_PATH);
  assert.equal(css.includes(":has("), false, "子が親を変える :has() は使わない");
  // 管理の枠の規則(印 admin-*)は src/app/admin/_layout/AdminFrame.test.tsx が見る
  const hides = rulesOf(css).filter((r) => r.decl.startsWith("display: none") && !r.selector.includes('data-frame-hide~="admin-'));
  const expected = parts.hideableParts("user").flatMap(({ slot }) => parts.FRAME_DEVICES.map((device) => `${slot}-${device}`));
  const found = hides.map((r) => /\[data-frame-hide~="([^"]+)"\]/.exec(r.selector)?.[1] ?? `?${r.selector}`);
  assert.deepEqual([...found].sort(), [...expected].sort());
  for (const rule of hides) {
    const token = /\[data-frame-hide~="([^"]+)"\]/.exec(rule.selector)?.[1] ?? "";
    const device = token.endsWith("-sp") ? "sp" : "pc";
    const slot = token.slice(0, -3);
    assert.equal(rule.media, MEDIA[device], `${token} は ${MEDIA[device]} の中`);
    assert.ok(rule.selector.startsWith(`[data-frame-root][data-frame-hide~="${token}"] :is(`), `${token} は外枠の属性から狙う`);
    assert.ok(rule.selector.includes(`[data-frame-part~="${slot}"]`), `${token} は data-frame-part="${slot}" も狙う`);
  }
});

test("ボトムナビを隠す間は --app-bottom-nav-height を 0 にし、fill は外枠の属性で確定高さにする", () => {
  const rules = rulesOf(read(CSS_PATH));
  for (const device of parts.FRAME_DEVICES) {
    const zero = rules.find((r) => r.selector === `[data-frame-root][data-frame-hide~="bottom-nav-${device}"]`);
    assert.equal(zero?.media, MEDIA[device]);
    assert.equal(zero?.decl, "--app-bottom-nav-height: 0px !important;");
  }
  const fill = rules.find((r) => r.selector === "[data-user-app-container][data-frame-fill]");
  assert.ok(fill && fill.media === null, "fill の規則が無い");
  assert.match(fill.decl, /height: var\(--viewport-height, 100dvh\);\s*min-height: 0;\s*overflow: clip;/);
  assert.ok(read("src/styles/_base/index.css").includes('@import "./frame.css";'), "index.css が frame.css を読まない");
});

test("規則の狙う先(id と data-frame-part)が既定の枠部品に実在し、外枠に data-frame-root がある", () => {
  const layout = "src/app/(user)/_layout";
  const sources = [
    "Header/index.tsx",
    "Header/Pc/PcNavigation.tsx",
    "Header/Sp/SpNavSwitch.tsx",
    "Header/Sp/SpNavigation.tsx",
    "Footer/index.tsx",
    "BottomNav/index.tsx",
    "BottomNav/BottomNavSpacer.tsx",
  ].map((file) => read(`${layout}/${file}`));
  const all = sources.join("\n") + read("src/components/AppFrames/constants.ts");
  // 管理の枠の規則(印 admin-* と data-admin-*)の狙う先は src/app/admin/_layout/AdminFrame.test.tsx が見る
  const css = rulesOf(read(CSS_PATH)).filter((r) => !/data-frame-hide~="admin-|data-admin-/.test(r.selector)).map((r) => r.selector).join("\n");
  for (const { slot } of parts.hideableParts("user")) {
    assert.ok(all.includes(`data-frame-part="${slot}"`), `data-frame-part="${slot}" の部品が無い`);
  }
  for (const id of new Set([...css.matchAll(/#([a-z-]+)/g)].map((m) => m[1]))) {
    assert.ok(all.includes(`"${id}"`), `#${id} の部品が無い`);
  }
  assert.ok(read(`${layout}/UserLayout.tsx`).includes('data-frame-root=""'));
});

const Probe = () => createElement("x-frame", useUserFrame());
const attrsAt = (current: string[] | null) => {
  segments.current = current;
  return render(createElement(Probe));
};

test("useUserFrame は今の segments に当たる表の行を属性にする(当たらなければ根の行、表に無ければ何も付けない)", () => {
  const table = [
    { pattern: [], scope: "layout", hide: ["bottom-nav-pc"], fill: false },
    { pattern: ["(auth)", "signup"], scope: "layout", hide: ["footer-sp", "bottom-nav-sp", "bottom-nav-pc"], fill: false },
    { pattern: ["game", "[id]"], scope: "page", hide: [], fill: true },
  ] as const;
  const pick = (s: string[]) => parts.matchFrame(s, table);
  assert.deepEqual(pick(["(auth)", "signup", "verify"]).hide, ["footer-sp", "bottom-nav-sp", "bottom-nav-pc"]);
  assert.deepEqual(pick(["game", "1"]), { hide: [], fill: true });
  assert.deepEqual(pick(["(public)", "about"]).hide, ["bottom-nav-pc"]);
  // 実際の表(extensions/frameTable.ts)で: 属性は当たった行の値
  for (const current of [[], ["(auth)", "signup"], ["(auth)", "demo-login"], ["maintenance"], ["(public)", "nowhere"]]) {
    const { hide, fill } = parts.matchFrame(current, frameTable);
    const html = attrsAt(current);
    assert.equal(html.includes(`data-frame-hide="${hide.join(" ")}"`), hide.length > 0, `${current.join("/")}: ${html}`);
    assert.equal(html.includes("data-frame-fill"), fill, `${current.join("/")}: ${html}`);
  }
  // app router の外(null)は segments = [] と同じ
  assert.equal(attrsAt(null), attrsAt([]));
});

test("上流の宣言: 準備中は header-nav・footer・bottom-nav、signup の下はボトムナビと SP のフッターを隠し、既定はボトムナビを PC で隠す、トップページ / だけ fill", () => {
  assert.deepEqual(parts.matchFrame([], frameTable), { hide: ["bottom-nav-pc"], fill: true });
  assert.deepEqual(parts.matchFrame(["(public)", "about"], frameTable), { hide: ["bottom-nav-pc"], fill: false }, "fill は / だけ(子のルートに継がない)");
  assert.deepEqual(parts.matchFrame(["maintenance"], frameTable).hide, ["header-nav-sp", "header-nav-pc", "footer-sp", "footer-pc", "bottom-nav-sp", "bottom-nav-pc"]);
  assert.deepEqual(parts.matchFrame(["(auth)", "signup", "verify"], frameTable).hide, ["footer-sp", "bottom-nav-sp", "bottom-nav-pc"]);
  assert.deepEqual(parts.matchFrame(["(auth)", "demo-login"], frameTable).hide, ["footer-sp", "footer-pc", "bottom-nav-sp", "bottom-nav-pc"]);
});
