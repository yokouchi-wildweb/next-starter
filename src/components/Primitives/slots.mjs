// src/components/Primitives/slots.mjs
// Primitives の印(data-slot)の一覧の読み手。一覧の元 = 各部品の README.md の「## data-slot の一覧」(fork に約束する名前)。
// 印の名前 = 属性の字面 + 包む上流の部品が渡す型つきの値(export type <X>Slot)。部品ごとの照合(./slots.test.mjs)と、枠の照合の shadcn の印との衝突の検査(src/app/(user)/_layout/UserFrame.test.tsx・
// src/app/admin/_layout/AdminFrame.test.tsx)が同じ物を読む。.mjs なのは node のテストからも tsx のテストからも読むため

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const PRIMITIVES_DIR = "src/components/Primitives";

/** 部品のフォルダ(1 部品 = 1 フォルダ) */
export function primitiveUnits(repoRoot) {
  const dir = join(repoRoot, PRIMITIVES_DIR);
  return readdirSync(dir)
    .filter((name) => statSync(join(dir, name)).isDirectory())
    .sort();
}

/** README の「## data-slot の一覧」の行 `- \`<名前>\`` の名前(節が無ければ null) */
export function readmeSlotsOf(readme) {
  const at = readme.indexOf("\n## data-slot の一覧");
  if (at < 0) return null;
  const section = readme.slice(at + 1).split(/\n## /)[0];
  return [...section.matchAll(/^- `([a-z0-9-]+)`/gm)].map((m) => m[1]);
}

/**
 * ソースの要素に付く印の字面(`data-slot="<名前>"` の属性だけ。`[data-slot="..."]` のセレクタの文字列は数えない)
 * @param {string} text
 */
export function attributeSlotsOf(text) {
  return [...text.matchAll(/(?<![[\w-])data-slot="([a-z0-9-]+)"/g)].map((m) => m[1]);
}

/**
 * 包む上流の部品が型つきの値で渡す印の名前(`export type <名前>Slot = "a" | "b";` の文字列リテラル。見出しと同じ形)
 * @param {string} text
 */
export function typedSlotsOf(text) {
  return [...text.matchAll(/export type \w+Slot\s*=\s*([^;]+);/g)].flatMap((m) => [...m[1].matchAll(/"([a-z0-9-]+)"/g)].map((n) => n[1]));
}

/** 開きタグの終わり(波括弧と引用符の中の > を飛ばす) */
function tagEnd(text, start) {
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    const c = text[i];
    if (c === "{") depth += 1;
    else if (c === "}") depth -= 1;
    else if ((c === '"' || c === "'") && depth === 0) i = text.indexOf(c, i + 1);
    else if (c === ">" && depth === 0) return i;
  }
  return text.length;
}

/**
 * 呼び手の props の広げ({...props} / {...rest})より前に置いた印(部品の印が呼び手に負ける並び)。名前の配列
 * @param {string} text
 */
export function marksBeforeSpreadOf(text) {
  const found = [];
  for (const m of text.matchAll(/(?<![[\w-])data-slot=("[^"]*"|\{[^}]*\})/g)) {
    const start = text.lastIndexOf("<", m.index);
    const tag = text.slice(start, tagEnd(text, start));
    const at = m.index - start;
    const spread = /\{\.\.\.(props|rest)\}/.exec(tag);
    if (spread && spread.index > at) found.push(m[1]);
  }
  return found;
}

/** 部品ごとの README の一覧とソースの印の字面 */
export function readUnitSlots(repoRoot) {
  return primitiveUnits(repoRoot).map((unit) => {
    const dir = join(repoRoot, PRIMITIVES_DIR, unit);
    const readmePath = join(dir, "README.md");
    let readme = null;
    try {
      readme = readFileSync(readmePath, "utf8");
    } catch {
      readme = null;
    }
    const sources = readdirSync(dir).filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name));
    const texts = sources.map((name) => readFileSync(join(dir, name), "utf8"));
    const used = [...new Set(texts.flatMap((text) => [...attributeSlotsOf(text), ...typedSlotsOf(text)]))];
    const beforeSpread = texts.flatMap((text) => marksBeforeSpreadOf(text));
    return { unit, listed: readme === null ? null : readmeSlotsOf(readme), used, beforeSpread };
  });
}

/** 全部品の README の一覧の名前(約束の名前の和) */
export function allPrimitiveSlots(repoRoot) {
  return [...new Set(readUnitSlots(repoRoot).flatMap((u) => u.listed ?? []))].sort();
}
