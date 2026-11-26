// 判定の核: 直接の親との差分(変更の一覧)と、基準側・fork 側の中身から各ファイルを分類する。
// git には触れない純粋関数(差分と中身の取得は呼び出し側)。Node 組み込みだけで動く .mjs
// 仕様: ./README.md「判定」

import { matchIntake } from "./intake.mjs";
import { classifyDottedName } from "../districtMap/index.mjs";
import { overrideTargetUnit, placeUnitOf, shelfUnitOf, unitFolderOf } from "./unitNames.mjs";
import { parseForkRegions, stripOwnedRegions } from "./regions.mjs";

const MARKER_LINE = /fork entries below/;

/**
 * @import { IntakeRule } from "./intake.mjs"
 * @import { UnitPlaces } from "./unitNames.mjs"
 * @typedef {{ status: string, path: string, from?: string }} OwnershipChange git diff --name-status -M <base> HEAD の 1 行(R は from → path)
 * @typedef {"none" | "valid" | "expired-resolved" | "expired-base" | "refresh"} PermitState
 * @typedef {OwnershipChange & {
 *   kind: string | null,
 *   reason: string,
 *   verdict: string,
 *   clash?: string,
 *   unitFolder?: string,
 *   permit?: PermitState,
 *   permitLine?: number,
 *   fingerprints?: { base: string, head: string },
 *   permitDraft?: string,
 *   jsonKey?: string,
 * }} OwnershipEntry 1 ファイルの判定(verdict = ok | violation | permitted。permit 以下は checkPermits と judgeFork が足す)
 */

/**
 * reason → verdict。violation 以外はすべて合格
 * @type {Readonly<Record<string, "ok" | "violation">>}
 */
export const REASONS = {
  added: "ok", // fork が足したファイル
  intake: "ok", // 受け口(edit)の中の書き換え
  self: "ok", // 型 5 self のファイル(各リポが自分の版を持つ。中身の検査は別)
  region: "ok", // fork の区画の中だけの書き換え
  marker: "ok", // 印より下だけの書き換え
  append: "ok", // 基準の中身を先頭に残した追記
  generated: "ok", // 生成物
  "generator-region": "ok", // 生成器の区画の中だけの書き換え(受け口の外のファイルでも)
  deleted: "violation", // 基準にあるファイルの削除
  renamed: "violation", // 基準にあるファイルの rename・移動
  "inside-unit-add": "violation", // 上流の単位の中へのファイル追加(部品の棚 src/components/<分類>/<単位>/・src/hooks|utils/<単位>/ と祖先の lib src/lib/<名前>/)
  "core-add": "violation", // src/domains/core/ の中への受け口の項目でない追加(fork のドメインは src/domains/<x>)
  "gate-add": "violation", // 門番 src/featureGate/ の中への受け口の項目でない追加(受け口は rules/・required/)
  "rules-core-add": "violation", // 上流の決まりのファイル .claude/rules/core/ の中への追加(自分の決まりは .claude/rules/ の core/ の外、D131)
  "unit-clash": "violation", // 検査する場所(部品の棚・受け口・wiring・route の隣・scripts の直下)への追加が基準の単位と同名(x.ts と x.tsx、ファイルとフォルダ)
  "override-own": "violation", // fork が足した <対象>.override の対象が基準に無い(override は上の Tier の項目にだけ)
  "default-add": "violation", // fork が基準のファイルのあるフォルダに <名前>.default.* を足した(既定はそこを作ったリポの物。自分のフォルダの自分の既定は可)
  "default-edit": "violation", // fork が基準の <名前>.default.* を書き換えた(既定の上に重ねる側のファイルに書く。1 行スイッチは隣の <名前>.replace)
  "frame-plain": "violation", // 親のルート(基準の page / layout / 枠の宣言のあるフォルダ)の隣に fork が印なしの frame.ts を足した(ルートを作ったリポの名前。fork は frame.override.ts)
  "outside-intake": "violation", // 受け口の外の書き換え
  "outside-region": "violation", // fork の区画の外も書き換えた
  "region-markers": "violation", // fork の区画の印が壊れている
  "above-marker": "violation", // 印より上も書き換えた(印が無い)
  "not-append": "violation", // 基準の中身を変えた
  "json-unparsed": "violation", // append の *.json が JSON として読めない(基準か fork の版)
  "json-upstream-key": "violation", // append の *.json で上流の鍵を消したか、上流の値を変えた(鍵を足すだけ。例外は JSON_FREE_KEYS)
  debt: "violation", // upstream の負債の箇所(一時許可で通す)
  "middle-tier": "ok", // 中間 Tier 以下の物(Tier1 の版に無いファイル)の書き換え・削除・rename(D29。check.mjs が付け替える、参考の一覧)
  picked: "ok", // 親の緊急修正を pick しただけの差(台帳の picked:。check.mjs が付け替える)
};

const libNameOf = (/** @type {string} */ path) => {
  const match = /^src\/lib\/([^/]+)\//.exec(path);
  return match ? match[1] : null;
};

const CORE_PREFIX = "src/domains/core/";
const GATE_PREFIX = "src/featureGate/";
const RULES_CORE_PREFIX = ".claude/rules/core/";

const headUntilMarker = (/** @type {string | null} */ text) => {
  if (text === null) return null;
  const lines = text.split("\n");
  const index = lines.findIndex((line) => MARKER_LINE.test(line));
  return index === -1 ? null : lines.slice(0, index + 1).join("\n");
};

/**
 * append の *.json で上流の値を変えてよい鍵(D304)。リポ直下からのパス → トップの鍵 → 値を変えてよい深さ
 *   "self" = その鍵の値そのもの(package.json の name: fork の名前)
 *   "children" = その鍵の下の各鍵の値(依存の 4 欄: 上流の依存の版の範囲。pnpm update・pnpm add で上げてよい。鍵を消すのは違反)
 * @type {Readonly<Record<string, Readonly<Record<string, "self" | "children">>>>}
 */
export const JSON_FREE_KEYS = {
  "package.json": {
    name: "self",
    dependencies: "children",
    devDependencies: "children",
    optionalDependencies: "children",
    peerDependencies: "children",
  },
};

const isPlainObject = (/** @type {unknown} */ value) => typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * 値の深い同値(JSON の値だけ: 鍵の順は問わない)
 * @returns {boolean}
 */
function jsonEqual(/** @type {unknown} */ a, /** @type {unknown} */ b) {
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((item, i) => jsonEqual(item, b[i]));
  }
  if (isPlainObject(a) && isPlainObject(b)) {
    const ka = Object.keys(/** @type {object} */ (a));
    const kb = Object.keys(/** @type {object} */ (b));
    return ka.length === kb.length && ka.every((key) => Object.hasOwn(/** @type {object} */ (b), key) && jsonEqual(/** @type {any} */ (a)[key], /** @type {any} */ (b)[key]));
  }
  return a === b;
}

/**
 * 基準の鍵を全部 head が持ち、値が同じか(head は鍵を足してよい: 対象はオブジェクトの下だけ再帰)。最初に違った鍵の道(a.b.c)を返す
 * @param {unknown} base
 * @param {unknown} head
 * @param {string[]} path
 * @param {(path: string[]) => "self" | "children" | null} freeAt
 * @returns {string | null}
 */
function firstUpstreamChange(base, head, path, freeAt) {
  const free = freeAt(path);
  if (free === "self") return null;
  if (isPlainObject(base)) {
    if (!isPlainObject(head)) return path.join(".") || "(全体)";
    for (const [key, value] of Object.entries(/** @type {object} */ (base))) {
      const next = [...path, key];
      if (!Object.hasOwn(/** @type {object} */ (head), key)) return next.join(".");
      // children: 鍵は残す、値は変えてよい
      if (free === "children") continue;
      const found = firstUpstreamChange(value, /** @type {any} */ (head)[key], next, freeAt);
      if (found !== null) return found;
    }
    return null;
  }
  return jsonEqual(base, head) ? null : path.join(".") || "(全体)";
}

/**
 * append の *.json: 鍵を足すだけ(上流の鍵を消さない・上流の値を変えない。JSON_FREE_KEYS の例外だけ変えてよい)
 * @param {string} path
 * @param {string} baseText
 * @param {string} headText
 * @returns {{ reason: string, jsonKey?: string }}
 */
export function judgeJsonAppend(path, baseText, headText) {
  let base;
  let head;
  try {
    base = JSON.parse(baseText);
    head = JSON.parse(headText);
  } catch {
    return { reason: "json-unparsed" };
  }
  const free = JSON_FREE_KEYS[path] ?? {};
  const freeAt = (/** @type {string[]} */ keys) => (keys.length === 1 ? (free[keys[0]] ?? null) : null);
  const jsonKey = firstUpstreamChange(base, head, [], freeAt);
  return jsonKey === null ? { reason: "append" } : { reason: "json-upstream-key", jsonKey };
}

const withoutTrailingNewlines = (/** @type {string} */ text) => text.replace(/\n+$/, "");

/**
 * 基準にあるファイルの書き換えの reason
 * @param {{ kind: string | null } | null} rule
 * @param {string} path
 * @param {string} baseText
 * @param {string} headText
 * @returns {{ reason: string, jsonKey?: string }}
 */
function judgeModified(rule, path, baseText, headText) {
  if (rule?.kind === "append" && path.endsWith(".json")) return judgeJsonAppend(path, baseText, headText);
  return { reason: judgeModifiedReason(rule, baseText, headText) };
}

/**
 * @param {{ kind: string | null } | null} rule
 * @param {string} baseText
 * @param {string} headText
 * @returns {string}
 */
function judgeModifiedReason(rule, baseText, headText) {
  const kind = rule?.kind ?? null;
  if (kind === "edit") return "intake";
  if (kind === "self") return "self";
  if (kind === "generated") return "generated";
  if (kind === "debt") return "debt";
  if (kind === "region") {
    if (parseForkRegions(headText).errors.length > 0) return "region-markers";
    return stripOwnedRegions(baseText) === stripOwnedRegions(headText) ? "region" : "outside-region";
  }
  if (kind === "marker") {
    const head = headUntilMarker(headText);
    return head !== null && head === headUntilMarker(baseText) ? "marker" : "above-marker";
  }
  if (kind === "append") {
    // 基準(末尾の改行を除く)で始まり、続きがあればその先頭が改行のときだけ追記。
    // 基準の最後の行に同じ行で書き足すのは基準の行の変更なので not-append
    const head = withoutTrailingNewlines(baseText);
    if (!headText.startsWith(head)) return "not-append";
    const rest = headText.slice(head.length);
    return rest === "" || rest.startsWith("\n") ? "append" : "not-append";
  }
  return stripOwnedRegions(baseText, { fork: false }) === stripOwnedRegions(headText, { fork: false })
    ? "generator-region"
    : "outside-intake";
}

const dirOf = (/** @type {string} */ path) => path.slice(0, Math.max(path.lastIndexOf("/"), 0));
/** 枠の宣言の上書き(src/app の frame.override.ts)。相手はそのルート(隣の page / layout、ルートを作ったリポの frame の宣言)で、frame という単位ではない */
const isFrameOverride = (/** @type {string} */ path) => path.startsWith("src/app/") && path.endsWith("/frame.override.ts");
/** 枠の宣言(src/app の frame.ts = ルートを作ったリポの名前) */
const isFramePlain = (/** @type {string} */ path) => path.startsWith("src/app/") && path.endsWith("/frame.ts");
/** 基準にそのフォルダのルート(page / layout)か枠の宣言があるか */
const baseHasRoute = (/** @type {Map<string, string>} */ baseUnits, /** @type {string} */ dir) => ["page", "layout", "frame", "frame.default"].some((name) => baseUnits.has(`${dir}/${name}`));
/** <名前>.default.<拡張子>(既定。D173: そこを作ったリポだけが書く) */
export const isDefaultName = (/** @type {string} */ path) => classifyDottedName(path.slice(path.lastIndexOf("/") + 1)).kind === "default";

/**
 * @param {{
 *   changes: OwnershipChange[],                                  // git diff --name-status -M <base> HEAD の各行(R は from → path)
 *   baseText: (path: string) => string | null,                   // 基準側の中身(無ければ null)
 *   headText: (path: string) => string | null,                   // fork 側の中身(無ければ null)
 *   baseLibs: Iterable<string>,                                  // 基準の src/lib 直下のディレクトリ名
 *   baseHasCore?: boolean,                                       // 基準に src/domains/core/ があるか
 *   baseHasGate?: boolean,                                       // 基準に src/featureGate/ があるか
 *   baseHasRulesCore?: boolean,                                  // 基準に .claude/rules/core/ があるか
 *   intake: Pick<IntakeRule, "kind" | "glob" | "exclude" | "line">[],  // parseIntake(基準側の intake.txt).rules
 *   places?: UnitPlaces | null,                                  // unitPlaces(基準のファイル)。無ければ単位名の検査をしない
 *   baseUnits?: Map<string, string>,                             // unitIndex(基準のファイル): 単位名 → 基準のパス
 * }} input
 * @returns {{ entries: OwnershipEntry[], counts: Record<string, number> }}
 *   unitFolder = inside-unit-add の単位のフォルダ(中間 Tier の付け替えが Tier1 の版にあるかを見る)
 */
export function judge({ changes, baseText, headText, baseLibs, baseHasCore = false, baseHasGate = false, baseHasRulesCore = false, intake, places = null, baseUnits = new Map() }) {
  const libs = new Set(baseLibs);
  // 基準のファイルのあるフォルダ(親の物の隣への *.default.* の追加 = default-add)
  const baseDirs = new Set([...baseUnits.values()].map(dirOf));
  /** @type {OwnershipEntry[]} */
  const entries = changes.map((change) => {
    const status = change.status[0];
    const rule = matchIntake(intake, change.path);
    /** @type {string} */
    let reason;
    /** @type {string | undefined} */
    let clash;
    /** @type {string | undefined} */
    let unitFolder;
    /** @type {string | undefined} */
    let jsonKey;
    if (status === "A") {
      const lib = libNameOf(change.path);
      const unit = places ? placeUnitOf(change.path, places) : null;
      const shelfUnit = places ? shelfUnitOf(change.path, places) : null;
      const target = overrideTargetUnit(change.path);
      const folder = places ? unitFolderOf(change.path, places) : null;
      // 受け口の add / edit の行に当たる追加は宣言された場所(core/ownership.md fork_ownership: outside a declared place だけが違反)
      const declared = rule !== null && (rule.kind === "add" || rule.kind === "edit");
      if (!declared && (folder !== null || (lib !== null && libs.has(lib)))) {
        reason = "inside-unit-add";
        unitFolder = folder ?? `src/lib/${lib}`;
      }
      else if (baseHasCore && change.path.startsWith(CORE_PREFIX) && (rule === null || rule.kind === "debt")) reason = "core-add";
      else if (baseHasGate && change.path.startsWith(GATE_PREFIX) && (rule === null || rule.kind === "debt")) reason = "gate-add";
      else if (baseHasRulesCore && change.path.startsWith(RULES_CORE_PREFIX)) reason = "rules-core-add";
      else if (unit !== null && baseUnits.has(unit)) {
        reason = "unit-clash";
        clash = baseUnits.get(unit);
      } else if (places && shelfUnit !== null && (baseUnits.has(shelfUnit) || places.unitFolders?.has(shelfUnit))) {
        // 部品の棚の新しい単位が基準の単位と同じ名前(ファイルとフォルダ、x.ts と x.tsx)。基準の単位のフォルダの中は上の inside-unit-add
        reason = "unit-clash";
        clash = baseUnits.get(shelfUnit) ?? `${shelfUnit}/`;
      } else if (places && target !== null && (isFrameOverride(change.path) ? !baseHasRoute(baseUnits, dirOf(change.path)) : !baseUnits.has(target))) reason = "override-own";
      // README「判定」の順: unit-clash → override-own → default-add → frame-plain
      else if (places && isDefaultName(change.path) && baseDirs.has(dirOf(change.path))) reason = "default-add";
      else if (places && isFramePlain(change.path) && baseHasRoute(baseUnits, dirOf(change.path))) reason = "frame-plain";
      else reason = "added";
    } else if (status === "D") {
      reason = "deleted";
    } else if (status === "R") {
      reason = "renamed";
    } else if (places && isDefaultName(change.path)) {
      reason = "default-edit";
    } else {
      ({ reason, jsonKey } = judgeModified(rule, change.path, baseText(change.path) ?? "", headText(change.path) ?? ""));
    }
    return { ...change, status, kind: rule?.kind ?? null, reason, verdict: REASONS[reason], ...(clash ? { clash } : {}), ...(unitFolder ? { unitFolder } : {}), ...(jsonKey ? { jsonKey } : {}) };
  });

  /** @type {Record<string, number>} */
  const counts = {};
  for (const entry of entries) counts[entry.reason] = (counts[entry.reason] ?? 0) + 1;
  return { entries, counts };
}
