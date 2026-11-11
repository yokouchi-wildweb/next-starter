// 実行: pnpm test src/app/_layout/frame/parts.test.mjs
// 部位の一覧(./parts.mjs)が 1 か所にあり、枠の実物と宣言の型に合うことを見る(指令 07 d5)。
// 隠す CSS(src/styles/core/frame.css)の部位 = 部位の一覧(両方の枠、印は data-slot だけ)もここで見る。
// 各枠の README の data-slot の一覧と実物(要素の data-slot)の照合は (user)/_layout の UserFrame.test・admin/_layout の AdminFrame.test
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

import ts from "typescript";

import { FRAME_DEVICES, FRAME_ROOTS, FRAME_SLOTS, hideableParts } from "./parts.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..");
const read = (path) => readFileSync(join(repoRoot, path), "utf8");

test("一覧: 31 名・重なりなし・kebab-case・管理の枠は admin-", () => {
  const names = FRAME_SLOTS.map((s) => s.name);
  assert.equal(names.length, 31);
  assert.equal(new Set(names).size, names.length);
  for (const s of FRAME_SLOTS) {
    assert.match(s.name, /^[a-z]+(?:-[a-z]+)*$/, s.name);
    if (s.area === "admin") assert.ok(s.name.startsWith("admin-"), s.name);
    if (s.area === "user" || s.area === "main") assert.ok(!s.name.startsWith("admin-"), s.name);
    if (s.hideable) assert.ok(s.area === "user" || s.area === "admin", `${s.name}: 隠せるのは枠の部位だけ`);
  }
});

test("見出しの印: 5 つとも source(印を描く部品のファイル)があり、そのファイルが名前の字面を持つ(描画の照合は src/components/TextBlocks/headingSlots.test.tsx)", () => {
  const headings = FRAME_SLOTS.filter((s) => s.area === "heading");
  assert.deepEqual(headings.map((s) => s.name), ["user-page-title", "page-title", "admin-page-title", "sec-title", "admin-sec-title"]);
  for (const s of headings) {
    assert.ok(s.source, `${s.name}: source が無い`);
    assert.ok(read(s.source).includes(`"${s.name}"`), `${s.name}: ${s.source} に名前が無い`);
  }
  for (const s of FRAME_SLOTS.filter((x) => x.area !== "heading")) assert.equal(s.source, undefined, `${s.name}: source は見出しだけ`);
});

test("隠せる部位: 利用者の 4 つ(D90)と管理の 3 つ、宣言のキーは接頭辞を除いた camelCase", () => {
  assert.deepEqual(hideableParts("user"), [
    { key: "header", slot: "header", hideSlots: ["header"] },
    { key: "headerNav", slot: "header-nav", hideSlots: ["header-nav"] },
    { key: "footer", slot: "footer", hideSlots: ["footer"] },
    { key: "bottomNav", slot: "bottom-nav", hideSlots: ["bottom-nav"] },
  ]);
  assert.deepEqual(hideableParts("admin"), [
    { key: "header", slot: "admin-header", hideSlots: ["admin-header"] },
    { key: "sidebar", slot: "admin-sidebar", hideSlots: ["admin-sidebar"] },
    { key: "footer", slot: "admin-footer", hideSlots: ["admin-footer"] },
  ]);
});

test("宣言の型(./types.ts)のキーの union = 隠せる部位のキー", () => {
  const types = read("src/app/_layout/frame/types.ts");
  const unionOf = (name) => [...new RegExp(`export type ${name} = ([^;]+);`).exec(types)[1].matchAll(/"([A-Za-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(unionOf("UserFrameKey"), hideableParts("user").map((p) => p.key));
  assert.deepEqual(unionOf("AdminFrameKey"), hideableParts("admin").map((p) => p.key));
});

test("枠の根: 枠の layout があるフォルダ", () => {
  for (const { dir } of Object.values(FRAME_ROOTS)) assert.ok(readdirSync(join(repoRoot, dir)).includes("layout.tsx"), dir);
});

/** CSS の規則(コメントを除き、@media の中も平らに読む) */
const rulesOf = (css) => {
  const body = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [];
  let media = null;
  for (const m of body.matchAll(/(@media[^{]+)\{|([^{}]+)\{([^{}]*)\}|\}/g)) {
    if (m[1]) media = m[1].trim();
    else if (m[2]) rules.push({ media, selector: m[2].trim(), decl: m[3].trim() });
    else media = null;
  }
  return rules;
};
const MEDIA = { sp: "@media (width < 40rem)", pc: "@media (width >= 40rem)" };
const FRAME_CSS = "src/styles/core/frame.css";

test("frame.css の隠す規則 = 両方の枠の隠せる部位 × 端末(過不足なし)、印は [data-slot] だけ、:has() なし", () => {
  const css = read(FRAME_CSS);
  const body = css.replace(/\/\*[\s\S]*?\*\//g, "");
  assert.equal(body.includes(":has("), false, "子が親を変える :has() は使わない");
  assert.equal(body.includes("data-frame-part"), false, "部位の印は data-slot だけ");
  const hides = rulesOf(css).filter((r) => r.decl.startsWith("display: none"));
  const tokenOf = (selector) => /\[data-frame-hide~="([^"]+)"\]/.exec(selector)?.[1] ?? `?${selector}`;
  const expected = Object.keys(FRAME_ROOTS).flatMap((root) => hideableParts(root).flatMap(({ slot }) => FRAME_DEVICES.map((d) => `${slot}-${d}`)));
  assert.deepEqual(hides.map((r) => tokenOf(r.selector)).sort(), [...expected].sort());
  for (const rule of hides) {
    const token = tokenOf(rule.selector);
    const device = token.endsWith("-sp") ? "sp" : "pc";
    const slot = token.slice(0, -3);
    assert.equal(rule.media, MEDIA[device], `${token} は ${MEDIA[device]} の中`);
    const prefix = `[data-frame-root][data-frame-hide~="${token}"] `;
    assert.ok(rule.selector.startsWith(prefix), `${token} は外枠の属性から狙う`);
    const part = Object.keys(FRAME_ROOTS).flatMap((root) => hideableParts(root)).find((p) => p.slot === slot);
    // 狙う先 = hideSlots の data-slot だけ(1 つなら素のまま、複数なら :is() に並べる)。id では狙わない
    const target = rule.selector.slice(prefix.length);
    const targets = (/^:is\((.*)\)$/.exec(target)?.[1] ?? target).split(",").map((t) => t.trim());
    assert.deepEqual(targets.sort(), part.hideSlots.map((n) => `[data-slot="${n}"]`).sort(), `${token} は hideSlots の data-slot だけを狙う`);
  }
});

/** 枠の根の下の _layout の .tsx(テストを除く) */
const layoutSources = (dir) =>
  readdirSync(join(repoRoot, dir)).flatMap((name) => {
    const path = `${dir}/${name}`;
    if (statSync(join(repoRoot, path)).isDirectory()) return layoutSources(path);
    return name.endsWith(".tsx") && !name.endsWith(".test.tsx") && path.includes("/_layout/") ? [path] : [];
  });
const attrOf = (node, name) => {
  const attr = node.attributes.properties.find((a) => ts.isJsxAttribute(a) && a.name.getText() === name);
  const init = attr?.initializer;
  if (!init) return undefined;
  if (ts.isStringLiteral(init)) return init.text;
  return undefined;
};
/** ファイルの JSX の要素ごとに { slots(自分と祖先の data-slot) } */
const jsxElementsOf = (path) => {
  const source = ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found = [];
  const walk = (node, slots) => {
    let next = slots;
    const opening = ts.isJsxElement(node) ? node.openingElement : ts.isJsxSelfClosingElement(node) ? node : null;
    if (opening) {
      const slot = attrOf(opening, "data-slot");
      next = slot ? [...slots, slot] : slots;
      found.push({ slots: next });
    }
    ts.forEachChild(node, (child) => walk(child, next));
  };
  walk(source, []);
  return found;
};

test("隠す対象は全部 data-slot で狙える: 隠せる部位ごとに、既定の枠部品に hideSlots の data-slot を持つ要素がある(frame.css は id を読まない)", () => {
  const body = read(FRAME_CSS).replace(/\/\*[\s\S]*?\*\//g, "");
  assert.equal(/#[a-z]/.test(body), false, "frame.css は id で狙わない");
  for (const root of Object.keys(FRAME_ROOTS)) {
    const elements = layoutSources(FRAME_ROOTS[root].dir).flatMap(jsxElementsOf);
    for (const part of hideableParts(root)) {
      const marked = elements.filter((e) => e.slots.at(-1) !== undefined && part.hideSlots.includes(e.slots.at(-1)));
      assert.ok(marked.length > 0, `${root}: ${part.slot} の data-slot を持つ要素が無い`);
    }
  }
});

test("frame.css: ボトムナビを隠す間は --app-bottom-nav-height を 0、利用者の fill は外枠の属性で確定高さ", () => {
  const rules = rulesOf(read(FRAME_CSS));
  for (const device of FRAME_DEVICES) {
    const zero = rules.find((r) => r.selector === `[data-frame-root][data-frame-hide~="bottom-nav-${device}"]`);
    assert.equal(zero?.media, MEDIA[device]);
    assert.equal(zero?.decl, "--app-bottom-nav-height: 0px !important;");
  }
  const fill = rules.find((r) => r.selector === '[data-frame-root][data-slot="app-container"][data-frame-fill]');
  assert.ok(fill && fill.media === null, "利用者の fill の規則が無い");
  assert.match(fill.decl, /height: var\(--viewport-height, 100dvh\);\s*min-height: 0;\s*overflow: clip;/);
  assert.ok(read("src/styles/core/index.css").includes('@import "./frame.css";'), "index.css が frame.css を読まない");
});
