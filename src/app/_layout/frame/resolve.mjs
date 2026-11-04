// src/app/_layout/frame/resolve.mjs
// 枠の宣言の形の検査・親の鎖と override の重ね・表の照合(純関数。生成器と実行時の読み手が共有する)。
// 宣言の形: { layout?: <値>, page?: <値> }、<値> = { hide?: { <キー>: { sp?: boolean, pc?: boolean } }, fill?: boolean }(キーは ./parts.mjs の hideableParts)
// 重ね: 浅い段から layout(frame.default.ts → frame.ts)、葉の段で最後に page(frame.default.ts → frame.ts)。
// 部位と端末ごとに上書き(省略 = 親のまま、false = 親の指定の取り消し、後が勝つ)。
// 表の行は生成時に解決済みの最終の値なので、照合は当たる行を 1 つ選ぶだけ(重ねない)。仕組み: ./README.md

import { FRAME_DEVICES, hideableParts } from "./parts.mjs";

const SCOPES = ["layout", "page"];
const VALUE_KEYS = ["hide", "fill"];
const isPlainObject = (v) => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * 宣言を確かめる(範囲のキーが 1 つ以上・知らないキーは失敗・各範囲の値の形)
 * @param {unknown} declaration
 * @param {"user" | "admin"} root
 * @returns {string[]} 問題の一覧
 */
export function checkFrameDeclaration(declaration, root) {
  if (!isPlainObject(declaration)) return ["宣言は { layout?: { … }, page?: { … } } の object"];
  const problems = [];
  for (const key of Object.keys(declaration)) if (!SCOPES.includes(key)) problems.push(`未知のキー ${key}(範囲は ${SCOPES.join(" / ")} で名指す。ページの中身は書かない)`);
  const scopes = SCOPES.filter((s) => declaration[s] !== undefined);
  if (scopes.length === 0 && problems.length === 0) problems.push(`範囲のキーが無い(${SCOPES.join(" / ")} の少なくとも 1 つ。layout = 隣の layout.tsx の下全部、page = 隣の page.tsx だけ)`);
  for (const scope of scopes) problems.push(...checkFrameValue(declaration[scope], root).map((p) => `${scope}: ${p}`));
  return problems;
}

/**
 * 1 つの範囲の値を確かめる
 * @param {unknown} value
 * @param {"user" | "admin"} root
 * @returns {string[]} 問題の一覧
 */
export function checkFrameValue(value, root) {
  if (!isPlainObject(value)) return ["値は { hide?: { … }, fill?: boolean } の object"];
  const problems = [];
  const parts = hideableParts(root);
  const keys = parts.map((p) => p.key);
  for (const key of Object.keys(value)) if (!VALUE_KEYS.includes(key)) problems.push(`未知のキー ${key}(書けるのは ${VALUE_KEYS.join(" / ")})`);
  if (value.fill !== undefined && typeof value.fill !== "boolean") problems.push("fill は真偽");
  if (value.hide !== undefined) {
    if (!isPlainObject(value.hide)) problems.push("hide は { <部位>: { sp?: boolean, pc?: boolean } }");
    else {
      for (const [key, setting] of Object.entries(value.hide)) {
        if (!keys.includes(key)) {
          problems.push(`hide の ${key} はこの枠の部位でない(書けるのは ${keys.join(" / ")})`);
          continue;
        }
        if (!isPlainObject(setting)) {
          problems.push(`hide.${key} は { sp?: boolean, pc?: boolean }`);
          continue;
        }
        for (const [device, flag] of Object.entries(setting)) {
          if (!FRAME_DEVICES.includes(device)) problems.push(`hide.${key} の ${device} は端末でない(${FRAME_DEVICES.join(" / ")})`);
          else if (typeof flag !== "boolean") problems.push(`hide.${key}.${device} は真偽`);
        }
      }
    }
  }
  return problems;
}

/** 何も宣言していない値 */
export const emptyFrame = () => ({ hide: {}, fill: undefined });

/**
 * 1 つの範囲の値を上に重ねた値(元は変えない)。値は checkFrameValue を通った物
 * @param {{ hide: Record<string, { sp?: boolean, pc?: boolean }>, fill?: boolean }} base 部位の名前で持つ値
 * @param {object | undefined} declaration 範囲の値(宣言の layout か page)
 * @param {"user" | "admin"} root
 */
export function overlayFrame(base, declaration, root) {
  const next = { hide: Object.fromEntries(Object.entries(base.hide).map(([slot, s]) => [slot, { ...s }])), fill: base.fill };
  if (!declaration) return next;
  const slotOf = new Map(hideableParts(root).map((p) => [p.key, p.slot]));
  for (const [key, setting] of Object.entries(declaration.hide ?? {})) {
    const slot = slotOf.get(key);
    next.hide[slot] = { ...next.hide[slot], ...setting };
  }
  if (declaration.fill !== undefined) next.fill = declaration.fill;
  return next;
}

/**
 * 表の行の値(隠す印 `<部位>-<端末>` の並びは一覧の順・端末の順、fill は真のときだけ真)
 * @returns {{ hide: string[], fill: boolean }}
 */
export function frameRowValue(value, root) {
  const hide = [];
  for (const { slot } of hideableParts(root)) for (const device of FRAME_DEVICES) if (value.hide[slot]?.[device] === true) hide.push(`${slot}-${device}`);
  return { hide, fill: value.fill === true };
}

/** 全部の部位を両方の端末で隠しているか(生成器の warn) */
export const hidesWholeFrame = (value, root) => frameRowValue(value, root).hide.length === hideableParts(root).length * FRAME_DEVICES.length;

/** segment の種類(並べ替えの強さ。小さいほど強い) */
const kindOf = (token) => (token.startsWith("[[...") ? 3 : token.startsWith("[...") ? 2 : token.startsWith("[") ? 1 : 0);

/**
 * 行の pattern が segments に当たるか。page = 同じ長さ(末尾の [[...x]] は無くてよい)、layout = 先頭が一致。
 * catch-all は 1 つの segment(useSelectedLayoutSegments は "a/b" の 1 文字列で返す)
 */
function fits(row, segments) {
  let pattern = row.pattern;
  const last = pattern[pattern.length - 1];
  if (last !== undefined && kindOf(last) === 3 && segments.length === pattern.length - 1) pattern = pattern.slice(0, -1);
  if (row.scope === "page" ? segments.length !== pattern.length : segments.length < pattern.length) return false;
  return pattern.every((token, i) => kindOf(token) !== 0 || token === segments[i]);
}

/** a が b より強ければ負: 長い方 → 位置ごとに静的 > 動的 > catch-all → page > layout */
function compareRows(a, b) {
  if (a.pattern.length !== b.pattern.length) return b.pattern.length - a.pattern.length;
  for (let i = 0; i < a.pattern.length; i += 1) {
    const d = kindOf(a.pattern[i]) - kindOf(b.pattern[i]);
    if (d !== 0) return d;
  }
  return (a.scope === "page" ? 0 : 1) - (b.scope === "page" ? 0 : 1);
}

/**
 * segments(枠の layout の下の useSelectedLayoutSegments、ルートグループを含む)に当たる行の値。無ければ何も隠さない
 * @param {readonly string[]} segments
 * @param {readonly { pattern: readonly string[], scope: "page" | "layout", hide: readonly string[], fill: boolean }[]} table
 * @returns {{ hide: readonly string[], fill: boolean }}
 */
export function matchFrame(segments, table) {
  let best = null;
  for (const row of table) if (fits(row, segments) && (best === null || compareRows(row, best) < 0)) best = row;
  return best ? { hide: best.hide, fill: best.fill } : { hide: [], fill: false };
}

/** 2 つの行の値が同じか */
export const sameFrameValue = (a, b) => a.fill === b.fill && a.hide.length === b.hide.length && a.hide.every((t, i) => t === b.hide[i]);
