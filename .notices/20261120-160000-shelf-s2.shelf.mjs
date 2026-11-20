#!/usr/bin/env node
// .notices/20261120-160000-shelf-s2.shelf.mjs
// 部品の棚の Form をほどく移行(区切り shelf-s2)に fork のコードを合わせる。fork のリポのルートで走らせる。
// 使い方: node .notices/20261120-160000-shelf-s2.shelf.mjs [--apply]
//   既定は dry-run(書き換える指定・動かすファイル・止める所・手で直す所の一覧を出すだけ)。--apply で書く。何度走らせても同じ結果。
//
// 上流で変わったこと(注文ごとに表の行が足される。今の行 = 注文 08):
// - 注文 08: Form/Button の 6 つのボタン → components/Button/<名前>、button-variants・tablet-button-variants → @/components/Button/variants
//   (Button・TabletButton からの buttonVariants・ButtonStyleProps・tabletButtonVariants の再輸出は無くなった。BookmarkTag は名前付きだけ)。
//   Form/Input/Manual の入力 → components/Input/<名前>(Manual の段は無くなった)、Form/Label → Input/Label、
//   Form/FilePickButton → Input/FilePickButton、Form/types・Form/utils の入力の型と関数(Options・OptionValue・OptionPrimitive …)→
//   @/components/Input/options。Form の入口・Form/Input の入口・Form/types に残る名前(AppForm・Controlled・react-hook-form の型 …)はそのまま
//
// することは 3 つ:
// 1. src・scripts のコード(.ts / .tsx / .mts / .mjs / .js / .jsx、git の管理下)の指定(@/… と相対の …)を書き換える
//    - 分けるモジュール(入口や、名前ごとに行き先が違うファイル)からの `import|export [type] { … } from` は、名前ごとに行き先へ 1 文ずつ分ける
//      (type・as はそのまま。残る名前は元の指定のまま)
//    - 名前空間(`import { Manual } from "@/components/Form/Input"`・`import * as M from "…/Input/Manual"`)は、`Manual.TextInput` などの
//      使い方を `TextInput` に直し、部品ごとの import を足す。同じ名前がそのファイルに既にあれば止める
//    - 動いた場所の指定は行き先に。相対の指定は、行き先が同じ分類(src/components/<分類>)の中なら相対のまま、外なら @/ に
//    - 名前付きだけになった部品(BookmarkTag)の default の import は名前付きに
// 2. fork が足した Form/Button・Form/Input/Manual・Form/FilePickButton の下のファイルを新しい場所の同じ名へ git mv
//    (中の相対の指定は新しい場所から引き直す)。行き先に同じ名があれば止める
// 3. 機械では直せない所を一覧に出す: 表にない名前・名前の重なり(STOP)、分けるモジュールを指す export *・mock.module・import()・
//    その他の文字列、JSON・Markdown の旧パスの字面(hand)
// STOP が 1 つでもあれば --apply でも書かない(手で直してから走らせ直す)。
// fork の手順: 上流のこの区切りを取り込む → dry-run → STOP を直す → --apply → hand を手で直す → pnpm typecheck・pnpm lint
//   (lint deprecated-imports が残りの旧パスを挙げる)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const P = path.posix;
const CODE = /\.(ts|tsx|mts|mjs|js|jsx)$/;
const DOC = /\.(md|mdx|json|jsonl)$/;
const EXT = /\.(tsx|ts|mts|mjs|jsx|js)$/;
const C = "src/components";
const F = `${C}/Form`;

// ─────────────────────────── 表(注文 09・10 はここに行を足す) ───────────────────────────

const BUTTON_VARIANTS = `${C}/Button/variants`;
const INPUT_OPTIONS = `${C}/Input/options`;

/** 名前 → 行き先のモジュールの表を作る。`default:X` = 行き先の default export の X */
const units = (table) => {
  const out = {};
  for (const [unit, names] of Object.entries(table)) {
    for (const n of names) {
      const isDefault = n.startsWith("default:");
      out[isDefault ? n.slice(8) : n] = { unit, isDefault };
    }
  }
  return out;
};

/** Form/Button の入口から読めた名前(注文 08) */
const BUTTON_NAMES = units({
  [`${C}/Button/Button`]: ["Button", "ButtonLoadingProps", "ButtonProps"],
  [BUTTON_VARIANTS]: ["buttonVariants", "ButtonStyleProps", "tabletButtonVariants", "TabletButtonStyleProps"],
  [`${C}/Button/LinkButton`]: ["LinkButton", "LinkButtonProps"],
  [`${C}/Button/PseudoButton`]: ["PseudoButton", "PseudoButtonProps"],
  [`${C}/Button/RoundedButton`]: ["RoundedButton", "RoundedButtonProps"],
  [`${C}/Button/BookmarkTag`]: ["BookmarkTag", "BookmarkTagProps"],
  [`${C}/Button/TabletButton`]: ["TabletButton", "TabletButtonProps"],
});

/** Form/Input/Manual の入口から読めた名前(注文 08) */
const MANUAL_NAMES = units({
  [`${C}/Input/CheckGroupInput`]: ["CheckGroupInput", "CheckGroupInputProps", "CheckGroupDisplayType", "CheckGroupOrientation"],
  [`${C}/Input/RadioGroupInput`]: ["RadioGroupInput", "RadioGroupInputProps", "RadioGroupDisplayType", "RadioGroupOrientation"],
  [`${C}/Input/BooleanRadioGroupInput`]: ["BooleanRadioGroupInput", "BooleanRadioGroupInputProps", "BooleanRadioGroupOption"],
  [`${C}/Input/BooleanCheckboxInput`]: ["BooleanCheckboxInput", "BooleanCheckboxInputProps"],
  [`${C}/Input/SingleCardCheckbox`]: ["SingleCardCheckbox", "SingleCardCheckboxProps"],
  [`${C}/Input/SwitchInput`]: ["SwitchInput", "SwitchInputProps"],
  [`${C}/Input/Select`]: ["SelectInput", "SelectInputProps"],
  [`${C}/Input/MultiSelectInput`]: ["MultiSelectInput", "MultiSelectInputProps"],
  [`${C}/Input/Input`]: ["Input"],
  [`${C}/Input/StepperInput`]: ["default:StepperInput"],
  [`${C}/Input/NumberInput`]: ["NumberInput", "NumberInputProps"],
  [`${C}/Input/DateInput`]: ["DateInput"],
  [`${C}/Input/TimeInput`]: ["TimeInput"],
  [`${C}/Input/DatetimeInput`]: ["DatetimeInput"],
  [`${C}/Input/Textarea`]: ["Textarea"],
  [`${C}/Input/FileInput`]: ["FileInput", "FileInputProps"],
  [`${C}/Input/PasswordInput`]: ["PasswordInput", "PasswordAutoComplete"],
  [`${C}/Input/OneTimeCodeInput`]: ["OneTimeCodeInput", "OneTimeCodeInputProps"],
  [`${C}/Input/ComboboxInput`]: ["ComboboxInput", "ComboboxInputProps"],
  [`${C}/Input/AsyncComboboxInput`]: ["AsyncComboboxInput", "AsyncComboboxInputProps"],
  [`${C}/Input/AsyncMultiSelectInput`]: ["AsyncMultiSelectInput", "AsyncMultiSelectInputProps"],
  [`${C}/Input/ColorInput`]: ["ColorInput", "ColorInputProps"],
  [`${C}/Input/ColorValueInput`]: ["ColorValueInput", "ColorValueInputProps"],
});

/** 入力の型と関数(Form/types・Form/utils から @/components/Input/options へ。注文 08) */
const OPTION_TYPE_NAMES = units({ [INPUT_OPTIONS]: ["OptionValue", "Options"] });
const OPTION_UTIL_NAMES = units({
  [INPUT_OPTIONS]: [
    "OptionPrimitive",
    "serializeOptionValue",
    "normalizeOptionValues",
    "includesOptionValue",
    "toggleOptionValue",
    "resolveOptionItemIdentity",
    "resolveOptionSearchText",
  ],
});

/**
 * 名前ごとに分けるモジュール(入口と、名前ごとに行き先が違うファイル)。
 * names = 名前 → 行き先 | rest = 表にない名前: "stay"(元の指定のまま)・"stop"(止める)・モジュールの道(そこへ)
 * namespaces = そのモジュールが出す名前空間 → その中身を分けるモジュールの道(使い方 `NS.X` を X に直す)
 */
const SPLITS = {
  [F]: {
    names: {
      ...units({ [`${C}/Input/Label`]: ["Label", "LabelProps"], [`${C}/Input/FilePickButton`]: ["FilePickButton", "FilePickButtonProps"] }),
      ...OPTION_TYPE_NAMES,
      ...OPTION_UTIL_NAMES,
      ...BUTTON_NAMES,
    },
    rest: "stay",
    namespaces: { Manual: `${F}/Input/Manual` },
  },
  [`${F}/Button`]: { names: BUTTON_NAMES, rest: "stop" },
  [`${F}/Button/Button`]: {
    names: units({ [BUTTON_VARIANTS]: ["buttonVariants", "ButtonStyleProps"] }),
    rest: `${C}/Button/Button`,
  },
  [`${F}/Button/TabletButton`]: { names: units({ [BUTTON_VARIANTS]: ["tabletButtonVariants"] }), rest: `${C}/Button/TabletButton` },
  [`${F}/Input`]: { names: {}, rest: "stay", namespaces: { Manual: `${F}/Input/Manual` } },
  [`${F}/Input/Manual`]: { names: MANUAL_NAMES, rest: "stop" },
  [`${F}/types`]: { names: OPTION_TYPE_NAMES, rest: "stay" },
  [`${F}/utils`]: { names: OPTION_UTIL_NAMES, rest: "stop" },
};

/** 動いたモジュール(分けるモジュールの後に見る)。prefix = その下も同じ相対の道で動いた */
const MOVES = [
  { from: `${F}/Button/button-variants`, to: BUTTON_VARIANTS },
  { from: `${F}/Button/tablet-button-variants`, to: BUTTON_VARIANTS },
  { from: `${F}/Button`, to: `${C}/Button`, prefix: true },
  { from: `${F}/Input/Manual`, to: `${C}/Input`, prefix: true },
  { from: `${F}/Label`, to: `${C}/Input/Label` },
  { from: `${F}/FilePickButton`, to: `${C}/Input/FilePickButton`, prefix: true },
];

/** 名前付きの export だけになった部品(行き先のモジュール → 名前)。default の import を名前付きに直す */
const DEFAULT_TO_NAMED = { [`${C}/Button/BookmarkTag`]: "BookmarkTag" };

/** fork が足したファイルを動かすフォルダ(上流のファイルは取り込みで既に動いている) */
const DIR_MOVES = [
  { from: `${F}/Button`, to: `${C}/Button` },
  { from: `${F}/Input/Manual`, to: `${C}/Input` },
  { from: `${F}/FilePickButton`, to: `${C}/Input/FilePickButton` },
];

/** JSON・Markdown で旧パスとみなす字面 */
const DOC_PATTERNS = [
  /components\/Form\/(Button|Input\/Manual|FilePickButton)(?![\w-])/,
  /components\/Form\/(Label|utils)(?![\w/-]|\.\w)/,
];

// ─────────────────────────── 仕組み ───────────────────────────

const git = (root, args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
const tracked = (root) => git(root, ["ls-files", "-z"]).split("\0").filter(Boolean);
const under = (mod, dir) => mod === dir || mod.startsWith(`${dir}/`);

/** 指定をモジュールの道(src/…、拡張子と /index なし)と、外した末尾に分ける。@/・相対・src/ 以外は null */
export function resolveSpecifier(fromFile, spec) {
  let raw;
  if (spec.startsWith("@/")) raw = `src/${spec.slice(2)}`;
  else if (spec.startsWith("./") || spec.startsWith("../")) raw = P.join(P.dirname(fromFile), spec);
  else if (spec.startsWith("src/")) raw = spec;
  else return null;
  let mod = P.normalize(raw);
  let suffix = "";
  const ext = EXT.exec(mod);
  if (ext) {
    suffix = ext[0];
    mod = mod.slice(0, -ext[0].length);
  }
  if (mod.endsWith("/index")) {
    suffix = `/index${suffix}`;
    mod = mod.slice(0, -"/index".length);
  }
  return { mod, suffix };
}

/** 動いたモジュールなら { to, prefix }。動いていなければ null */
export function mapModule(mod) {
  for (const m of MOVES) {
    if (mod === m.from) return { to: m.to, prefix: !!m.prefix };
    if (m.prefix && mod.startsWith(`${m.from}/`)) return { to: `${m.to}${mod.slice(m.from.length)}`, prefix: true };
  }
  return null;
}

/** 単位の根(src/components/<分類>・src/lib/<名前>・src/features/<名前>)。ほかは null */
const unitRoot = (p) => {
  const m = /^src\/(components|lib|features)\/[^/]+/.exec(p);
  return m ? m[0] : null;
};

/**
 * モジュールの道を指定に戻す。@/ と src/ の指定は @/ に。相対の指定は、行き先が書き出す場所と同じ単位の根の中なら相対、外なら @/
 */
export function emitSpecifier(origSpec, emitFrom, mod, suffix = "") {
  const relative = origSpec.startsWith("./") || origSpec.startsWith("../");
  if (relative) {
    const root = unitRoot(emitFrom);
    if (root && under(mod, root)) {
      let rel = P.relative(P.dirname(emitFrom), mod);
      if (!rel.startsWith(".")) rel = `./${rel}`;
      return `${rel}${suffix}`;
    }
  }
  return `@/${mod.slice(4)}${suffix}`;
}

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

/** `{ a, type b, c as d }` の中身を項目に分ける。読めない項目があれば null */
function parseItems(body) {
  const items = [];
  for (const part of stripComments(body).split(",")) {
    const t = part.trim();
    if (!t) continue;
    const m = /^(type\s+)?([\w$]+)(?:\s+as\s+([\w$]+))?$/.exec(t);
    if (!m) return null;
    items.push({ type: !!m[1], name: m[2], alias: m[3] ?? null });
  }
  return items;
}

const itemText = ({ type, name, alias }) => `${type ? "type " : ""}${name}${alias && alias !== name ? ` as ${alias}` : ""}`;
const lineOf = (text, index) => text.slice(0, index).split("\n").length;

/** ファイルの中で名前を縛っている物(import の名前・宣言)。名前空間を外したときの重なりを見る */
function boundNames(text) {
  const names = new Set();
  for (const m of text.matchAll(/\bimport\s+(?:type\s+)?([\w$]+)?\s*,?\s*(?:\{([^}]*)\})?\s*(?:\*\s+as\s+([\w$]+))?\s*from\b/g)) {
    if (m[1] && m[1] !== "type") names.add(m[1]);
    if (m[3]) names.add(m[3]);
    for (const it of parseItems(m[2] ?? "") ?? []) names.add(it.alias ?? it.name);
  }
  for (const m of text.matchAll(/\b(?:const|let|var|function\*?|class|type|interface|enum)\s+([\w$]+)/g)) names.add(m[1]);
  return names;
}

/** 分けるモジュールの中の名前を行き先へ。{ unit, isDefault } | { stay: true } | null(止める) */
function targetOf(split, name) {
  const hit = split.names[name];
  if (hit) return hit;
  if (split.rest === "stay") return { stay: true };
  if (split.rest === "stop") return null;
  return { unit: split.rest, isDefault: false };
}

/** 1 つの行き先への import / export の文 */
function statementFor(kw, stmtType, quote, spec, semi, group) {
  const parts = [];
  if (group.def) parts.push(group.def);
  if (group.named.length) parts.push(`{ ${group.named.map(itemText).join(", ")} }`);
  return `${kw}${stmtType ? " type" : ""} ${parts.join(", ")} from ${quote}${spec}${quote}${semi ? ";" : ""}`;
}

/** 項目を行き先ごとの組に入れる(default の部品は default の import か `default as X` に) */
function addToGroup(groups, key, hit, it, kw, stmtType) {
  if (!groups.has(key)) groups.set(key, { def: null, named: [] });
  const g = groups.get(key);
  if (hit.isDefault && kw === "import" && !stmtType && !it.type) g.def = it.alias ?? it.name;
  else if (hit.isDefault) g.named.push({ type: it.type, name: "default", alias: it.alias ?? it.name });
  else g.named.push(it);
}

/**
 * 1 本のコードのファイルの中身を書き換える。
 * @param {string} fromFile いまの場所(相対の指定はここから解く)
 * @param {string} text 中身
 * @param {{ emitFrom?: string, exists?: (mod: string) => boolean }} [opts]
 *   emitFrom = 書き出す場所(動かすファイルなら行き先)。exists = その道のモジュールが木にあるか
 * @returns {{ text: string, hits: string[], stops: string[], hands: string[] }} hits・stops・hands は `<行>: <内容>`
 */
export function rewriteSource(fromFile, text, opts = {}) {
  const emitFrom = opts.emitFrom ?? fromFile;
  const relocating = emitFrom !== fromFile;
  const exists = opts.exists ?? (() => false);
  const edits = [];
  const handled = [];
  const hits = [];
  const stops = [];
  const hands = [];
  const isHandled = (i) => handled.some(([s, e]) => i >= s && i < e);
  const specOf = (orig, mod, suffix = "") => emitSpecifier(orig, emitFrom, mod, suffix);
  /** 動いていない指定も、ファイルを動かすなら相対を引き直す */
  const keepSpec = (orig, r) => (relocating && (orig.startsWith("./") || orig.startsWith("../")) ? specOf(orig, r.mod, r.suffix) : orig);
  /** 名前空間の使い方 `NS.X` を X に直す。直せなければ止める理由を返す */
  const bound = boundNames(text);
  const namespaceEdits = (local, splitKey, line) => {
    const split = SPLITS[splitKey];
    const re = new RegExp(`(?<![\\w$.])${local.replace(/\$/g, "\\$")}\\.([A-Za-z_$][\\w$]*)`, "g");
    const uses = [...text.matchAll(re)];
    const members = [...new Set(uses.map((u) => u[1]))];
    const bad = [];
    for (const name of members) {
      if (!targetOf(split, name) || targetOf(split, name).stay) bad.push(`${local}.${name} の行き先が無い`);
      else if (bound.has(name)) bad.push(`${name} がこのファイルで既に使われている(名前空間を外すと重なる)`);
    }
    if (bad.length) {
      stops.push(`${line}: ${bad.join("・")}(手で直す)`);
      return null;
    }
    return { members, uses };
  };

  // 1. 分けるモジュール・名前付きだけになった部品を読む `import|export [type] [X,] { … } from "…"`
  const BRACE = /\b(import|export)(\s+type)?\s+(?:([\w$]+)\s*,\s*)?\{([^}]*)\}\s*from\s*(["'])([^"'\n]+)\5(\s*;)?/g;
  for (const m of text.matchAll(BRACE)) {
    const [whole, kw, stmtType, defaultLocal, body, quote, spec, semi] = m;
    const r = resolveSpecifier(fromFile, spec);
    if (!r) continue;
    const line = lineOf(text, m.index);
    const end = m.index + whole.length;
    const split = SPLITS[r.mod];
    const moved = mapModule(r.mod);
    const target = moved ? moved.to : r.mod;
    const namedOnly = DEFAULT_TO_NAMED[target];
    if (!split && !namedOnly) continue;
    handled.push([m.index, end]);
    const items = parseItems(body);
    if (!items) {
      hands.push(`${line}: ${spec} の import の中身が読めない(手で分ける)`);
      continue;
    }
    if (!split) {
      // 名前付きだけになった部品: default を名前付きに
      let changed = false;
      const out = items.map((it) => {
        if (it.name !== "default") return it;
        changed = true;
        return { ...it, name: namedOnly, alias: it.alias === namedOnly ? null : it.alias };
      });
      if (defaultLocal) {
        changed = true;
        out.unshift({ type: false, name: namedOnly, alias: defaultLocal === namedOnly ? null : defaultLocal });
      }
      const nextSpec = specOf(spec, target, moved?.prefix ? r.suffix : "");
      if (!changed && nextSpec === spec) continue;
      edits.push([m.index, end, `${kw}${stmtType ? " type" : ""} { ${out.map(itemText).join(", ")} } from ${quote}${nextSpec}${quote}${semi ? ";" : ""}`]);
      hits.push(`${line}: ${spec} → ${nextSpec}${changed ? `(${namedOnly} の default → 名前付き)` : ""}`);
      continue;
    }
    if (defaultLocal) {
      stops.push(`${line}: ${spec} に default はない(手で直す)`);
      continue;
    }
    const groups = new Map();
    const bad = [];
    const nsEdits = [];
    for (const it of items) {
      const nsKey = split.namespaces?.[it.name];
      if (nsKey && kw === "import") {
        const ns = namespaceEdits(it.alias ?? it.name, nsKey, line);
        if (!ns) {
          bad.push(null);
          continue;
        }
        const nsSplit = SPLITS[nsKey];
        for (const name of ns.members) addToGroup(groups, targetOf(nsSplit, name).unit, targetOf(nsSplit, name), { type: false, name, alias: null }, kw, stmtType);
        nsEdits.push(ns);
        continue;
      }
      if (nsKey) {
        bad.push(`${it.name} は名前空間(export で渡さず部品ごとに)`);
        continue;
      }
      const hit = targetOf(split, it.name);
      if (!hit) {
        bad.push(`${it.name} の行き先が無い`);
        continue;
      }
      addToGroup(groups, hit.stay ? "" : hit.unit, hit, it, kw, stmtType);
    }
    if (bad.length) {
      const reasons = bad.filter(Boolean);
      if (reasons.length) stops.push(`${line}: ${spec} の ${reasons.join("・")}(手で直す)`);
      continue;
    }
    if ([...groups.keys()].every((k) => k === "") && keepSpec(spec, r) === spec) continue;
    const stmts = [];
    const targets = [];
    for (const [unit, g] of groups) {
      const nextSpec = unit === "" ? keepSpec(spec, r) : specOf(spec, unit);
      if (unit !== "") targets.push(nextSpec);
      stmts.push(statementFor(kw, stmtType, quote, nextSpec, semi, g));
    }
    const next = stmts.join("\n");
    if (next === whole) continue;
    edits.push([m.index, end, next]);
    for (const ns of nsEdits) for (const u of ns.uses) edits.push([u.index, u.index + u[0].length, u[1]]);
    hits.push(`${line}: ${spec} → ${targets.length ? targets.join(", ") : "(残る名前だけ)"}${nsEdits.length ? "(名前空間を外した)" : ""}`);
  }

  // 1b. `import [type] X from "…"`(名前付きだけになった部品の default、分けるモジュールの default)
  const DEFAULT = /\bimport(\s+type)?\s+([\w$]+)\s+from\s*(["'])([^"'\n]+)\3(\s*;)?/g;
  for (const m of text.matchAll(DEFAULT)) {
    if (isHandled(m.index)) continue;
    const [whole, stmtType, local, quote, spec, semi] = m;
    if (local === "type") continue;
    const r = resolveSpecifier(fromFile, spec);
    if (!r) continue;
    const line = lineOf(text, m.index);
    const moved = mapModule(r.mod);
    const target = moved ? moved.to : r.mod;
    if (DEFAULT_TO_NAMED[target]) {
      handled.push([m.index, m.index + whole.length]);
      const named = DEFAULT_TO_NAMED[target];
      const nextSpec = specOf(spec, target, moved?.prefix ? r.suffix : "");
      const it = { type: false, name: named, alias: local === named ? null : local };
      edits.push([m.index, m.index + whole.length, `import${stmtType ? " type" : ""} { ${itemText(it)} } from ${quote}${nextSpec}${quote}${semi ? ";" : ""}`]);
      hits.push(`${line}: ${spec} → ${nextSpec}(${named} の default → 名前付き)`);
    } else if (SPLITS[r.mod]) {
      handled.push([m.index, m.index + whole.length]);
      stops.push(`${line}: ${spec} に default はない(手で直す)`);
    }
  }

  // 1c. `import * as M from "…"`(分けるモジュールの名前空間の import)
  const STAR = /\bimport\s+\*\s+as\s+([\w$]+)\s+from\s*(["'])([^"'\n]+)\2(\s*;)?/g;
  for (const m of text.matchAll(STAR)) {
    const [whole, local, quote, spec, semi] = m;
    const r = resolveSpecifier(fromFile, spec);
    if (!r || !SPLITS[r.mod]) continue;
    const line = lineOf(text, m.index);
    handled.push([m.index, m.index + whole.length]);
    if (SPLITS[r.mod].rest === "stay") {
      hands.push(`${line}: ${spec} の import * as(残る名前もあるので手で分ける)`);
      continue;
    }
    bound.delete(local);
    const ns = namespaceEdits(local, r.mod, line);
    if (!ns) continue;
    const groups = new Map();
    for (const name of ns.members) addToGroup(groups, targetOf(SPLITS[r.mod], name).unit, targetOf(SPLITS[r.mod], name), { type: false, name, alias: null }, "import", false);
    const stmts = [...groups].map(([unit, g]) => statementFor("import", false, quote, specOf(spec, unit), semi, g));
    edits.push([m.index, m.index + whole.length, stmts.join("\n")]);
    for (const u of ns.uses) edits.push([u.index, u.index + u[0].length, u[1]]);
    hits.push(`${line}: ${spec} の名前空間 ${local} → ${stmts.length} 文`);
  }

  // 2. 残りの文字列の指定: 動いたものは書き換え、分けるモジュールは手で
  const LITERAL = /(["'`])([^"'`\n]+)\1/g;
  for (const m of text.matchAll(LITERAL)) {
    if (isHandled(m.index)) continue;
    const [, quote, spec] = m;
    if (spec.includes("${")) continue;
    const r = resolveSpecifier(fromFile, spec);
    if (!r) continue;
    const line = lineOf(text, m.index);
    const moved = mapModule(r.mod);
    const isPlainPath = spec.startsWith("src/");
    if (SPLITS[r.mod]) {
      hands.push(`${line}: ${spec} は名前ごとに行き先が分かれた(export *・mock.module・import()・文字列は手で行き先へ)`);
    } else if (moved) {
      if (isPlainPath) {
        hands.push(`${line}: ${spec} は ${moved.to} へ動いた(道の文字列は手で直す)`);
        continue;
      }
      const next = specOf(spec, moved.to, moved.prefix ? r.suffix : "");
      edits.push([m.index, m.index + m[0].length, `${quote}${next}${quote}`]);
      hits.push(`${line}: ${spec} → ${next}`);
    } else if (relocating && !isPlainPath && (spec.startsWith("./") || spec.startsWith("../")) && exists(r.mod)) {
      const next = specOf(spec, r.mod, r.suffix);
      if (next === spec) continue;
      edits.push([m.index, m.index + m[0].length, `${quote}${next}${quote}`]);
      hits.push(`${line}: ${spec} → ${next}`);
    }
  }

  edits.sort((a, b) => b[0] - a[0]);
  let out = text;
  for (const [s, e, t] of edits) out = out.slice(0, s) + t + out.slice(e);
  return { text: out, hits, stops: [...new Set(stops)], hands: [...new Set(hands)] };
}

export function plan(root) {
  const files = tracked(root).filter((f) => existsSync(path.join(root, f)));
  const read = (file) => {
    try {
      return readFileSync(path.join(root, file), "utf8");
    } catch {
      return null;
    }
  };
  const mods = new Set(files.filter((f) => CODE.test(f)).map((f) => resolveSpecifier(f, `./${P.basename(f)}`).mod));

  const moves = [];
  const stops = [];
  for (const file of files) {
    const dm = DIR_MOVES.find((d) => file.startsWith(`${d.from}/`));
    if (!dm) continue;
    const to = `${dm.to}${file.slice(dm.from.length)}`;
    if (existsSync(path.join(root, to))) stops.push({ file, line: 0, text: `${to} がある(名前を変えてから走らせ直す)` });
    else moves.push({ from: file, to });
  }

  const rewrites = [];
  const hands = [];
  for (const file of files) {
    if (!(file.startsWith("src/") || file.startsWith("scripts/"))) continue;
    if (CODE.test(file)) {
      const text = read(file);
      if (text == null) continue;
      const moved = moves.find((mv) => mv.from === file);
      const res = rewriteSource(file, text, { emitFrom: moved?.to, exists: (mod) => mods.has(mod) });
      for (const s of res.stops) stops.push({ file, ...splitLine(s) });
      for (const h of res.hands) hands.push({ file, ...splitLine(h) });
      if (res.text !== text) rewrites.push({ file, next: res.text, hits: res.hits });
    } else if (DOC.test(file)) {
      const text = read(file);
      if (text == null) continue;
      text.split("\n").forEach((l, i) => {
        for (const re of DOC_PATTERNS) {
          const mm = re.exec(l);
          if (mm) {
            hands.push({ file, line: i + 1, text: `${mm[0]} の字面(JSON・Markdown は手で直す)` });
            break;
          }
        }
      });
    }
  }
  return { rewrites, moves, stops, hands };
}

function splitLine(s) {
  const at = s.indexOf(": ");
  return { line: Number(s.slice(0, at)), text: s.slice(at + 2) };
}

export function apply(root, result) {
  for (const { from, to } of result.moves) {
    mkdirSync(path.dirname(path.join(root, to)), { recursive: true });
    git(root, ["mv", from, to]);
  }
  for (const { file, next } of result.rewrites) {
    const moved = result.moves.find((m) => m.from === file);
    writeFileSync(path.join(root, moved ? moved.to : file), next);
  }
}

function main() {
  const root = process.cwd();
  const result = plan(root);
  const at = (file, line) => (line ? `${file}:${line}` : file);
  for (const { file, hits } of result.rewrites) for (const hit of hits) console.log(`rewrite ${at(file, Number(hit.slice(0, hit.indexOf(":"))))}: ${hit.slice(hit.indexOf(": ") + 2)}`);
  for (const { from, to } of result.moves) console.log(`move ${from} -> ${to}`);
  for (const { file, line, text } of result.stops) console.log(`STOP ${at(file, line)}: ${text}`);
  for (const { file, line, text } of result.hands) console.log(`hand ${at(file, line)}: ${text}`);
  if (!result.rewrites.length && !result.moves.length && !result.stops.length) console.log("変えるものなし");
  if (result.stops.length) process.exit(1);
  if (process.argv.includes("--apply")) {
    apply(root, result);
    console.log("applied");
  } else console.log("dry-run(--apply で書く)");
}

if (import.meta.url === `file://${process.argv[1]}`) main();
