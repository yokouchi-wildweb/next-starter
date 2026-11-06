// 実行: pnpm test:style-tokens
// ヘッダーの高さの初期値(frame.css の外枠ごと・端末ごとの --app-header-height)を確かめる(指令 15 AMENDMENT 1 (1))。
// - 測る前の値が 0 でない(利用者・管理 × SP・PC)、計算した値 = 今の行の高さ(実測: 利用者 53 / 73、管理 52 / 88)
// - 宣言でヘッダーを隠す端末は 0(!important で外枠の inline に勝つ)
// - 値を組み立てた部品のクラスがまだそのままか(変わったら frame.css の calc() を直す)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (path) => readFileSync(join(repoRoot, path), "utf8");
const frameCss = read("src/styles/core/frame.css").replace(/\/\*[\s\S]*?\*\//g, "");
const configCss = read("src/styles/core/config.css").replace(/\/\*[\s\S]*?\*\//g, "");

const ROOTS = { user: '[data-frame-root][data-slot="app-container"]', admin: '[data-frame-root][data-slot="admin-app-container"]' };
const PC_MEDIA = "@media (width >= 40rem)";
const SP_MEDIA = "@media (width < 40rem)";

/** CSS をトップレベルの塊に分ける: { media: "" | "@media …", selector, body } */
function rules(css) {
  const out = [];
  let i = 0;
  const block = (start) => {
    let depth = 0;
    for (let j = start; j < css.length; j += 1) {
      if (css[j] === "{") depth += 1;
      else if (css[j] === "}" && --depth === 0) return j;
    }
    return css.length;
  };
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open === -1) break;
    const head = css.slice(i, open).trim();
    const close = block(open);
    const body = css.slice(open + 1, close);
    if (head.startsWith("@media")) for (const inner of rules(body)) out.push({ ...inner, media: head });
    else out.push({ media: "", selector: head, body });
    i = close + 1;
  }
  return out;
}

const declOf = (body, name) => new RegExp(`${name}\\s*:\\s*([^;]+);`).exec(body)?.[1].trim() ?? null;
const valueAt = (css, selector, media, name) => rules(css).find((r) => r.selector === selector && r.media === media && declOf(r.body, name) !== null)?.body;

/** --admin-header-padding-y の端末ごとの値(config.css の :root と sm の @media) */
const paddingY = {
  sp: declOf(valueAt(configCss, ":root", "", "--admin-header-padding-y"), "--admin-header-padding-y"),
  pc: declOf(rules(configCss).find((r) => r.media.includes("40rem") && declOf(r.body, "--admin-header-padding-y"))?.body ?? "", "--admin-header-padding-y"),
};

/** calc() を px に(rem = 16px、var(--admin-header-padding-y) は端末の値) */
function px(expression, device) {
  const js = expression
    .replace(/^calc\((.*)\)$/, "$1")
    .replace(/var\(--admin-header-padding-y\)/g, `(${paddingY[device]})`)
    .replace(/([\d.]+)rem/g, (_, n) => `(${n} * 16)`)
    .replace(/([\d.]+)px/g, "$1");
  assert.match(js, /^[\d\s.*+()-]+$/, `計算できない式: ${expression}`);
  return Function(`return (${js});`)();
}

const initial = (root, device) => declOf(valueAt(frameCss, ROOTS[root], device === "pc" ? PC_MEDIA : "", "--app-header-height") ?? "", "--app-header-height");

test("測る前の値は 0 でない: 外枠ごと・端末ごとの初期値 = 今の行の高さ", () => {
  const expected = { user: { sp: 53, pc: 73 }, admin: { sp: 52, pc: 88 } };
  for (const root of ["user", "admin"]) {
    for (const device of ["sp", "pc"]) {
      const value = initial(root, device);
      assert.ok(value, `${root} ${device}: 初期値が無い`);
      assert.doesNotMatch(value, /!important/, "測った inline の値が上書きできる");
      assert.equal(px(value, device), expected[root][device], `${root} ${device}: ${value}`);
      assert.notEqual(px(value, device), 0);
    }
  }
});

test("宣言でヘッダーを隠す端末は 0(!important)", () => {
  for (const [part, device, media] of [["header", "sp", SP_MEDIA], ["header", "pc", PC_MEDIA], ["admin-header", "sp", SP_MEDIA], ["admin-header", "pc", PC_MEDIA]]) {
    const body = valueAt(frameCss, `[data-frame-root][data-frame-hide~="${part}-${device}"]`, media, "--app-header-height");
    assert.equal(declOf(body ?? "", "--app-header-height"), "0px !important", `${part}-${device}`);
  }
});

test("枠の外は config.css の :root の 0px のまま", () => {
  assert.equal(declOf(valueAt(configCss, ":root", "", "--app-header-height"), "--app-header-height"), "0px");
});

test("初期値を組み立てた部品のクラスがそのまま(変わったら frame.css の calc() を直す)", () => {
  const has = (path, re, why) => assert.match(read(path), re, `${path}: ${why}(frame.css のヘッダーの高さの初期値を直す)`);
  has("src/app/(user)/_layout/Header/HeaderShell.tsx", /data-slot="header-shell"[^>]*className="[^"]*\bpy-2 sm:py-4\b/, "行の上下の余白 py-2 / sm:py-4");
  has("src/app/(user)/_layout/Header/Brand.tsx", /className="h-9 w-auto sm:h-10"/, "ロゴの高さ h-9 / sm:h-10");
  has("src/app/(user)/_layout/Header/index.tsx", /data-slot="header"[\s\S]*?className="[^"]*\bborder-b\b/, "下の線 border-b 1px");
  has("src/app/admin/_layout/AdminHeader.default.tsx", /py-\[var\(--admin-header-padding-y\)\]/, "行の上下の余白 = --admin-header-padding-y");
  has("src/app/admin/_layout/AdminHeader.default.tsx", /className="block shrink-0 p-1 sm:p-2"/, "ロゴのリンクの余白 p-1 / sm:p-2");
  has("src/app/admin/_layout/AdminHeader.default.tsx", /max-h-6 [^"]*sm:max-h-12/, "ロゴの高さ max-h-6 / sm:max-h-12");
  has("src/app/admin/_layout/AdminHeader.default.tsx", /<DarkModeSwitch \/>/, "SP の行の高さを決めるダークモードのスイッチ");
  has("src/components/Fanctional/DarkModeSwitch.tsx", /size="icon"/, "スイッチは icon の大きさ");
  has("src/components/Form/Button/button-variants.ts", /icon: "size-9"/, "icon の大きさ size-9(2.25rem)");
  assert.deepEqual(paddingY, { sp: "0.5rem", pc: "0.75rem" }, "config.css の --admin-header-padding-y");
});
