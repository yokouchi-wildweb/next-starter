// 実行: pnpm test:style-tokens
// ヘッダーの高さの初期値(frame.css の外枠ごと・端末ごとの --app-header-height)を確かめる(指令 15 AMENDMENT 1 (1)・指令 21 AMENDMENT 2)。
// - 測る前の値が 0 でない(利用者・管理 × SP・PC)、値 = 今の行の高さ(利用者 53 / 73 = 部品のクラスの calc()、管理 52 / 88)
// - 管理は行の高さの値 --admin-header-row-height(config.css、1 か所)をそのまま読む(子のクラスの calc() にしない)
// - 宣言でヘッダーを隠す端末は 0(!important で外枠の inline に勝つ)
// - 利用者の値を組み立てた部品のクラスがまだそのままか(変わったら frame.css の calc() を直す)
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

/** config.css の :root と sm の @media の値 */
const configValue = (name) => ({
  sp: declOf(valueAt(configCss, ":root", "", name) ?? "", name),
  pc: declOf(rules(configCss).find((r) => r.media.includes("40rem") && declOf(r.body, name))?.body ?? "", name),
});
const rowHeight = configValue("--admin-header-row-height");

/** calc() / var(--admin-header-row-height) を px に(rem = 16px) */
function px(expression, device) {
  const js = expression
    .replace(/^calc\((.*)\)$/, "$1")
    .replace(/var\(--admin-header-row-height\)/g, `(${rowHeight[device]})`)
    .replace(/([\d.]+)rem/g, (_, n) => `(${n} * 16)`)
    .replace(/([\d.]+)px/g, "$1");
  assert.match(js, /^[\d\s.*+()-]+$/, `計算できない式: ${expression}`);
  return Function(`return (${js});`)();
}

/** 端末の初期値(PC の @media に無ければ SP の規則の値を継ぐ) */
const initial = (root, device) => {
  const at = (media) => declOf(valueAt(frameCss, ROOTS[root], media, "--app-header-height") ?? "", "--app-header-height");
  return device === "pc" ? (at(PC_MEDIA) ?? at("")) : at("");
};

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

test("管理の初期値は行の高さの値 --admin-header-row-height を読むだけ(子のクラスの calc() にしない)、値は config.css の 1 か所で 52 / 88px", () => {
  assert.equal(initial("admin", "sp"), "var(--admin-header-row-height)");
  assert.equal(initial("admin", "pc"), "var(--admin-header-row-height)");
  assert.deepEqual(rowHeight, { sp: "3.25rem", pc: "5.5rem" });
  const declared = rules(frameCss).filter((r) => declOf(r.body, "--admin-header-row-height") !== null);
  assert.deepEqual(declared, [], "frame.css は行の高さの値を定義しない(config.css だけ)");
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

test("利用者の初期値を組み立てた部品のクラスがそのまま(変わったら frame.css の calc() を直す)", () => {
  const has = (path, re, why) => assert.match(read(path), re, `${path}: ${why}(frame.css のヘッダーの高さの初期値を直す)`);
  has("src/app/(user)/_layout/Header/HeaderShell.tsx", /data-slot="header-shell"[^>]*className="[^"]*\bpy-2 sm:py-4\b/, "行の上下の余白 py-2 / sm:py-4");
  has("src/app/(user)/_layout/Header/Brand.tsx", /className="h-9 w-auto sm:h-10"/, "ロゴの高さ h-9 / sm:h-10");
  has("src/app/(user)/_layout/Header/index.tsx", /data-slot="header"[\s\S]*?className="[^"]*\bborder-b\b/, "下の線 border-b 1px");
});
