#!/usr/bin/env node
// .notices/20261120-160000-shelf-s2.shelf.mjs
// 部品の棚の Form をほどく移行(区切り shelf-s2)に fork のコードを合わせる。fork のリポのルートで走らせる。
// 使い方: node .notices/20261120-160000-shelf-s2.shelf.mjs [--apply]
//   既定は dry-run(書き換える指定・動かすファイル・止める所・手で直す所の一覧を出すだけ)。--apply で書く。何度走らせても同じ結果。
//
// 上流で変わったこと(注文ごとに表の行が足される。今の行 = 注文 08・09・10):
// - 注文 10: domain.json の項目の型は lib/domain の DomainField 1 つになり、型の名前は @/lib/domain へ移って改名した:
//   FieldDataType → NeonFieldType、FieldDataTypeFirestore → FirestoreFieldType、FieldOption → DomainFieldOption、
//   FormInputType → BuiltinFormInput(@/lib/formSuite から)。lib/domain の FieldOption も DomainFieldOption に、
//   DomainConfigField(DomainField の別名)は DomainField に。
//   useRelationOptions(と UseRelationOptionsResult)は @/lib/domain/hooks から @/lib/formSuite へ。
//   formSuite の FieldType・FormFieldProps は代わり無しで無くなった(読む所は STOP、手で直す)
// - 注文 09: Form の残り(AppForm・AutoSave・Field・FieldRenderer・FormActions・Input/Controlled・submitLock・backgroundFailure・types)は
//   閉じた lib @/lib/formSuite(入口 1 本、下の道は読まない)、Form/MediaHandler は @/lib/mediaInputSuite。components/Form は無くなった。
//   移した先の入口が出していない名前は STOP(行き先の入口がこの木にあるときに確かめる)
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
const FORM_SUITE = "src/lib/formSuite";
const MEDIA_SUITE = "src/lib/mediaInputSuite";
const DOMAIN = "src/lib/domain";

/**
 * 名前 → 行き先のモジュールの表を作る。`default:X` = 行き先の default export の X、`X=>Y` = 行き先では Y という名前
 * (読む側は `Y as X` で元の名前のまま使う。名前空間の使い方 NS.X は Y に直す)
 */
const units = (table) => {
  const out = {};
  for (const [unit, names] of Object.entries(table)) {
    for (const n of names) {
      const isDefault = n.startsWith("default:");
      const bare = isDefault ? n.slice(8) : n;
      const [from, to] = bare.split("=>");
      out[from] = { unit, isDefault, ...(to ? { rename: to } : {}) };
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

/** Form/MediaHandler の名前(注文 09: @/lib/mediaInputSuite の入口へ) */
const MEDIA_NAMES = units({
  [MEDIA_SUITE]: [
    "ManualMediaInput",
    "ManualMediaInputProps",
    "ControlledMediaInput",
    "ControlledMediaInputProps",
    "ManualMediaUploader",
    "ManualMediaUploaderProps",
    "ControlledMediaUploader",
    "ControlledMediaUploaderProps",
    "ControlledMediaUploaderBridgeProps",
    "ControlledMediaUploaderMulti",
    "ControlledMediaUploaderMultiProps",
    "ControlledMediaUploaderMultiBridgeProps",
    "MediaUploaderFieldRenderer",
    "UseMediaUploaderFieldOptions",
    "UseMediaUploaderFieldResult",
    "useMediaUploaderField",
    "MediaUploaderMultiFieldRenderer",
    "UseMediaUploaderMultiFieldOptions",
    "UseMediaUploaderMultiFieldResult",
    "useMediaUploaderMultiField",
  ],
});

/** Form/Field/types のうち入力の側の型(注文 09: @/components/Input/options へ) */
const FIELD_INPUT_TYPE_NAMES = units({ [INPUT_OPTIONS]: ["FormControlA11yProps"] });

/**
 * Form/Input/Controlled の名前(注文 09): 入力の部品は棚の Input の単位と同じ名前なので、@/lib/formSuite の入口では頭に
 * Controlled を付けた名前(名前空間は無い)。読む側は使う所ごと新しい名前に直す(同じ名前がそのファイルに既にあれば `as` で元の名前)。
 * Controlled*Props の型は今の名前のまま(表にない名前 = 同じ名前で formSuite)
 */
const CONTROLLED_NAMES = units({
  [FORM_SUITE]: [
    "DateInput=>ControlledDateInput",
    "DatetimeInput=>ControlledDatetimeInput",
    "TimeInput=>ControlledTimeInput",
    "FileInput=>ControlledFileInput",
    "FileInputProps=>ControlledFileInputProps",
    "NumberInput=>ControlledNumberInput",
    "PasswordInput=>ControlledPasswordInput",
    "SwitchInput=>ControlledSwitchInput",
    "EmailInput=>ControlledEmailInput",
    "TextInput=>ControlledTextInput",
    "Textarea=>ControlledTextarea",
    "MultiSelectInput=>ControlledMultiSelectInput",
    "CheckGroupInput=>ControlledCheckGroupInput",
    "RadioGroupInput=>ControlledRadioGroupInput",
    "SelectInput=>ControlledSelectInput",
    "BooleanCheckboxInput=>ControlledBooleanCheckboxInput",
    "BooleanRadioGroupInput=>ControlledBooleanRadioGroupInput",
    "SingleCardCheckbox=>ControlledSingleCardCheckbox",
    "StepperInput=>ControlledStepperInput",
    "ComboboxInput=>ControlledComboboxInput",
    "AsyncComboboxInput=>ControlledAsyncComboboxInput",
    "AsyncMultiSelectInput=>ControlledAsyncMultiSelectInput",
    "ColorInput=>ControlledColorInput",
    "ColorValueInput=>ControlledColorValueInput",
  ],
});

/** 項目の型の名前(注文 10: @/lib/formSuite から @/lib/domain へ移って改名) */
const FIELD_TYPE_NAMES = units({
  [DOMAIN]: [
    "FieldDataType=>NeonFieldType",
    "FieldDataTypeFirestore=>FirestoreFieldType",
    "FieldOption=>DomainFieldOption",
    "FormInputType=>BuiltinFormInput",
  ],
});

/** 代わり無しで無くなった formSuite の名前(注文 10) */
const FORM_SUITE_GONE = {
  FieldType: "formSuite の FieldType は代わり無しで無くなった(手で直す)",
  FormFieldProps: "formSuite の FormFieldProps は代わり無しで無くなった(手で直す)",
};

/** lib/domain の改名(注文 10: 同じ入口の DomainFieldOption・別名だった DomainConfigField は DomainField) */
const DOMAIN_OPTION_NAMES = units({ [DOMAIN]: ["FieldOption=>DomainFieldOption", "DomainConfigField=>DomainField"] });

/** lib/domain/hooks から formSuite へ移った名前(注文 10) */
const RELATION_OPTION_NAMES = units({ [FORM_SUITE]: ["useRelationOptions", "UseRelationOptionsResult"] });

/**
 * 名前ごとに分けるモジュール(入口と、名前ごとに行き先が違うファイル)。
 * names = 名前 → 行き先 | rest = 表にない名前: "stay"(元の指定のまま)・"stop"(止める)・モジュールの道(そこへ)
 * gone = 代わり無しで無くなった名前 → 止める理由
 * 行き先のモジュールにもその名前の行があれば、もう一段たどる(旧 Form の道 → formSuite → lib/domain)
 * namespaces = そのモジュールが出す名前空間 → その中身を分けるモジュールの道(使い方 `NS.X` を X に直す)
 */
const SPLITS = {
  [F]: {
    names: {
      ...units({ [`${C}/Input/Label`]: ["Label", "LabelProps"], [`${C}/Input/FilePickButton`]: ["FilePickButton", "FilePickButtonProps"] }),
      ...OPTION_TYPE_NAMES,
      ...OPTION_UTIL_NAMES,
      ...BUTTON_NAMES,
      ...MEDIA_NAMES,
      ...FIELD_INPUT_TYPE_NAMES,
    },
    rest: FORM_SUITE,
    namespaces: { Manual: `${F}/Input/Manual`, Controlled: `${F}/Input/Controlled` },
  },
  [`${F}/Button`]: { names: BUTTON_NAMES, rest: "stop" },
  [`${F}/Button/Button`]: {
    names: units({ [BUTTON_VARIANTS]: ["buttonVariants", "ButtonStyleProps"] }),
    rest: `${C}/Button/Button`,
  },
  [`${F}/Button/TabletButton`]: { names: units({ [BUTTON_VARIANTS]: ["tabletButtonVariants"] }), rest: `${C}/Button/TabletButton` },
  [`${F}/Input`]: { names: {}, rest: FORM_SUITE, namespaces: { Manual: `${F}/Input/Manual`, Controlled: `${F}/Input/Controlled` } },
  [`${F}/Input/Controlled`]: { names: CONTROLLED_NAMES, rest: FORM_SUITE },
  [`${F}/Field`]: { names: FIELD_INPUT_TYPE_NAMES, rest: FORM_SUITE },
  [`${F}/Field/types`]: { names: FIELD_INPUT_TYPE_NAMES, rest: FORM_SUITE },
  [`${F}/Input/Manual`]: { names: MANUAL_NAMES, rest: "stop" },
  [`${F}/types`]: { names: OPTION_TYPE_NAMES, rest: FORM_SUITE },
  [`${F}/utils`]: { names: OPTION_UTIL_NAMES, rest: "stop" },
  // 注文 10
  [FORM_SUITE]: { names: FIELD_TYPE_NAMES, rest: "stay", gone: FORM_SUITE_GONE },
  [DOMAIN]: { names: DOMAIN_OPTION_NAMES, rest: "stay" },
  [`${DOMAIN}/fields`]: { names: DOMAIN_OPTION_NAMES, rest: "stay" },
  [`${DOMAIN}/fields/extractFields`]: { names: DOMAIN_OPTION_NAMES, rest: "stay" },
  [`${DOMAIN}/types`]: { names: DOMAIN_OPTION_NAMES, rest: "stay" },
  [`${DOMAIN}/types/domainConfig`]: { names: DOMAIN_OPTION_NAMES, rest: "stay" },
  [`${DOMAIN}/hooks`]: { names: RELATION_OPTION_NAMES, rest: "stay" },
};

/** その下のどのファイルにも同じ名前の表を当てるフォルダ(注文 09: Controlled の入力のファイルを深く読む所) */
const PREFIX_SPLITS = [{ from: `${F}/Input/Controlled`, split: SPLITS[`${F}/Input/Controlled`] }];

/** モジュールの分け方(SPLITS のその道、無ければ PREFIX_SPLITS の当たるフォルダの表)。無ければ undefined */
const splitOf = (mod) => SPLITS[mod] ?? PREFIX_SPLITS.find((p) => mod.startsWith(`${p.from}/`))?.split;

/** 動いたモジュール(分けるモジュールの後に見る)。prefix = その下も同じ相対の道で動いた */
const MOVES = [
  { from: `${F}/Button/button-variants`, to: BUTTON_VARIANTS },
  { from: `${F}/Button/tablet-button-variants`, to: BUTTON_VARIANTS },
  { from: `${F}/Button`, to: `${C}/Button`, prefix: true },
  { from: `${F}/Input/Manual`, to: `${C}/Input`, prefix: true },
  { from: `${F}/Label`, to: `${C}/Input/Label` },
  { from: `${F}/FilePickButton`, to: `${C}/Input/FilePickButton`, prefix: true },
  // 注文 09: 閉じた lib・open lib の入口 1 本へ(collapse = 下の道を残さない)。上の行より後に見る
  { from: `${F}/MediaHandler`, to: MEDIA_SUITE, collapse: true },
  { from: F, to: FORM_SUITE, collapse: true },
  // 注文 10
  { from: `${DOMAIN}/hooks/useRelationOptions`, to: FORM_SUITE },
];

/** 名前付きの export だけになった部品(行き先のモジュール → 名前)。default の import を名前付きに直す */
const DEFAULT_TO_NAMED = { [`${C}/Button/BookmarkTag`]: "BookmarkTag" };

/** fork が足したファイルを動かすフォルダ(上流のファイルは取り込みで既に動いている) */
const DIR_MOVES = [
  { from: `${F}/Button`, to: `${C}/Button` },
  { from: `${F}/Input/Manual`, to: `${C}/Input` },
  { from: `${F}/FilePickButton`, to: `${C}/Input/FilePickButton` },
];

/** fork が足したファイルが残っていたら止めるフォルダ(DIR_MOVES の後に見る) */
const DIR_GONE = [
  {
    from: F,
    reason: "components/Form は無くなった(閉じた lib formSuite の中には置けない): fork の部品は components/Button・components/Input の単位か自分の lib へ手で置き直す",
  },
];

/** JSON・Markdown で旧パスとみなす字面 */
const DOC_PATTERNS = [
  /components\/Form\/(Button|Input\/Manual|FilePickButton)(?![\w-])/,
  /components\/Form\/(Label|utils)(?![\w/-]|\.\w)/,
  /components\/Form(?![\w-])/,
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
    if (m.collapse && under(mod, m.from)) return { to: m.to, prefix: false };
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

/**
 * 分けるモジュールの中の名前を行き先へ。{ unit, isDefault, rename? } | { stay: true } | { gone: 理由 } | null(止める)。
 * 行き先のモジュールにもその名前の行(names・gone)があれば、もう一段たどる(改名は合わせる)
 */
function targetOf(split, name, depth = 0) {
  if (split.gone?.[name]) return { gone: split.gone[name] };
  let hit = split.names[name];
  if (!hit) {
    if (split.rest === "stay") return { stay: true };
    if (split.rest === "stop") return null;
    hit = { unit: split.rest, isDefault: false };
  }
  const next = SPLITS[hit.unit];
  if (hit.isDefault || !next || next === split || depth > 3) return hit;
  const nextName = hit.rename ?? name;
  const h2 = targetOf({ ...next, rest: "stay" }, nextName, depth + 1);
  if (h2.stay) return hit;
  if (h2.gone) return h2;
  return { ...h2, ...(h2.rename || nextName !== name ? { rename: h2.rename ?? nextName } : {}) };
}

/** 残る名前のある(rest "stay")分けるモジュールは、表の名前をそのファイルが書いているときだけ手の行を出す */
const namesListedIn = (split, text) =>
  [...Object.keys(split.names), ...Object.keys(split.gone ?? {})].some((n) => new RegExp(`(?<![\\w$])${n}(?![\\w$])`).test(text));
const needsHand = (split, text) => split.rest !== "stay" || namesListedIn(split, text);

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
  else if (hit.rename) g.named.push({ type: it.type, name: hit.rename, alias: it.alias ?? it.name });
  else g.named.push(it);
}

/** 行き先の入口が出す名前(export の宣言・{ … }・export * を辿る)。読めない入口は null */
export function exportsOfText(text, readRelative, seen = new Set()) {
  const names = new Set();
  for (const m of text.matchAll(/^export\s+(?:declare\s+)?(?:async\s+)?(?:const|let|var|function\*?|class|type|interface|enum)\s+([\w$]+)/gm)) names.add(m[1]);
  if (/^export\s+default\b/m.test(text)) names.add("default");
  for (const m of text.matchAll(/^export\s+(?:type\s+)?\{([^}]*)\}/gm)) {
    for (const it of parseItems(m[1]) ?? []) names.add(it.alias ?? it.name);
  }
  for (const m of text.matchAll(/^export\s+\*\s+as\s+([\w$]+)\s+from/gm)) names.add(m[1]);
  for (const m of text.matchAll(/^export\s+\*\s+from\s*["']([^"']+)["']/gm)) {
    const sub = readRelative(m[1]);
    if (!sub || seen.has(sub.path)) continue;
    seen.add(sub.path);
    for (const n of exportsOfText(sub.text, sub.readRelative, seen)) if (n !== "default") names.add(n);
  }
  return names;
}

/**
 * 1 本のコードのファイルの中身を書き換える。
 * @param {string} fromFile いまの場所(相対の指定はここから解く)
 * @param {string} text 中身
 * @param {{ emitFrom?: string, exists?: (mod: string) => boolean, exportsOf?: (mod: string) => Set<string> | null }} [opts]
 *   emitFrom = 書き出す場所(動かすファイルなら行き先)。exists = その道のモジュールが木にあるか。
 *   exportsOf = 行き先の入口が出す名前(入口がこの木に無ければ null = 確かめない)
 * @returns {{ text: string, hits: string[], stops: string[], hands: string[] }} hits・stops・hands は `<行>: <内容>`
 */
export function rewriteSource(fromFile, text, opts = {}) {
  const emitFrom = opts.emitFrom ?? fromFile;
  const relocating = emitFrom !== fromFile;
  const exists = opts.exists ?? (() => false);
  const exportsOf = opts.exportsOf ?? (() => null);
  /** 行き先の入口が出していない名前(import する側の名前で)。入口が無ければ確かめない */
  const missingIn = (unit, names) => {
    const ex = exportsOf(unit);
    return ex ? names.filter((n) => !ex.has(n)) : [];
  };
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
  /** このファイルが Input の単位(@/components/Input/… か旧 Form/Input/Manual…)から読んでいる名前(読み元での名前) */
  const inputUnitNames = new Set();
  for (const m of text.matchAll(/\bimport\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']([^"'\n]+)["']/g)) {
    const rr = resolveSpecifier(fromFile, m[2]);
    if (!rr || !(under(rr.mod, `${C}/Input`) || under(rr.mod, `${F}/Input/Manual`))) continue;
    for (const it of parseItems(m[1]) ?? []) inputUnitNames.add(it.name);
  }
  const namespaceEdits = (local, splitKey, line) => {
    const split = SPLITS[splitKey];
    const re = new RegExp(`(?<![\\w$.])${local.replace(/\$/g, "\\$")}\\.([A-Za-z_$][\\w$]*)`, "g");
    const uses = [...text.matchAll(re)];
    const members = [...new Set(uses.map((u) => u[1]))];
    const bad = [];
    /** 使い方 NS.X を直した後の名前(行き先での名前が違えばそれ) */
    const finalName = (name) => targetOf(split, name)?.rename ?? name;
    for (const name of members) {
      const hit = targetOf(split, name);
      if (!hit || hit.stay || hit.gone) bad.push(hit?.gone ? `${local}.${name}: ${hit.gone}` : `${local}.${name} の行き先が無い`);
      else if (bound.has(finalName(name))) bad.push(`${finalName(name)} がこのファイルで既に使われている(名前空間を外すと重なる)`);
    }
    if (bad.length) {
      stops.push(`${line}: ${bad.join("・")}(手で直す)`);
      return null;
    }
    return { members, uses, finalName };
  };
  /** 名前空間の中身を行き先ごとの組へ(行き先で名前が違えば、その名前のまま import する) */
  const addNamespaceMembers = (groups, ns, nsSplit, kw, stmtType) => {
    for (const name of ns.members) {
      const hit = targetOf(nsSplit, name);
      addToGroup(groups, hit.unit, { ...hit, rename: undefined }, { type: false, name: ns.finalName(name), alias: null }, kw, stmtType);
    }
  };

  // 1. 分けるモジュール・名前付きだけになった部品を読む `import|export [type] [X,] { … } from "…"`
  const BRACE = /\b(import|export)(\s+type)?\s+(?:([\w$]+)\s*,\s*)?\{([^}]*)\}\s*from\s*(["'])([^"'\n]+)\5(\s*;)?/g;
  for (const m of text.matchAll(BRACE)) {
    const [whole, kw, stmtType, defaultLocal, body, quote, spec, semi] = m;
    const r = resolveSpecifier(fromFile, spec);
    if (!r) continue;
    const line = lineOf(text, m.index);
    const end = m.index + whole.length;
    const moved = mapModule(r.mod);
    const target = moved ? moved.to : r.mod;
    // 動いただけのモジュールでも、行き先が分けるモジュールならその表で分ける(残る名前は行き先へ。注文 10)
    const movedSplit = !splitOf(r.mod) && moved && !moved.prefix ? splitOf(moved.to) : undefined;
    const split = splitOf(r.mod) ?? (movedSplit && { ...movedSplit, rest: movedSplit.rest === "stay" ? moved.to : movedSplit.rest });
    const namedOnly = DEFAULT_TO_NAMED[target];
    if (!split && !namedOnly) {
      // 動いただけのモジュール: 行き先の入口が名前を出しているかだけ見て、指定の書き換えは 2. に任せる
      if (!moved) continue;
      const its = parseItems(body);
      const missing = its ? missingIn(target, [...(defaultLocal ? ["default"] : []), ...its.map((it) => it.name)]) : [];
      if (missing.length) {
        handled.push([m.index, end]);
        stops.push(`${line}: ${spec} → ${specOf(spec, target)} の入口に ${missing.join("・")} が無い(入口に足すか手で直す)`);
      }
      continue;
    }
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
    const renames = [];
    for (const it of items) {
      const nsKey = split.namespaces?.[it.name];
      if (nsKey && kw === "import") {
        const ns = namespaceEdits(it.alias ?? it.name, nsKey, line);
        if (!ns) {
          bad.push(null);
          continue;
        }
        addNamespaceMembers(groups, ns, SPLITS[nsKey], kw, stmtType);
        nsEdits.push(ns);
        continue;
      }
      if (nsKey) {
        bad.push(`${it.name} は名前空間(export で渡さず部品ごとに)`);
        continue;
      }
      const hit = targetOf(split, it.name);
      if (!hit || hit.gone) {
        bad.push(hit?.gone ? `${it.name}: ${hit.gone}` : `${it.name} の行き先が無い`);
        continue;
      }
      if (hit.rename && kw === "import") {
        // 行き先で名前が違う(Controlled の入力 → ControlledX): そのファイルの使う所(as で付けた名前も)を新しい名前に直す。
        // `ControlledX as <元の名前>` で残すのは、同じ名前の Input の単位をそのファイルが既に読んでいるとき(と新しい名前が既に使われているとき)だけ
        const local = it.alias ?? it.name;
        if (!inputUnitNames.has(it.name) && !bound.has(hit.rename)) {
          addToGroup(groups, hit.unit, { ...hit, rename: undefined }, { type: it.type, name: hit.rename, alias: null }, kw, stmtType);
          renames.push([local, hit.rename]);
          continue;
        }
      }
      addToGroup(groups, hit.stay ? "" : hit.unit, hit, it, kw, stmtType);
    }
    if (bad.length) {
      const reasons = bad.filter(Boolean);
      if (reasons.length) stops.push(`${line}: ${spec} の ${reasons.join("・")}(手で直す)`);
      continue;
    }
    if ([...groups.keys()].every((k) => k === "") && keepSpec(spec, r) === spec) continue;
    const missing = [];
    for (const [unit, g] of groups) {
      if (unit === "") continue;
      for (const n of missingIn(unit, [...(g.def ? ["default"] : []), ...g.named.map((it) => it.name)])) missing.push(`${specOf(spec, unit)} の ${n}`);
    }
    if (missing.length) {
      stops.push(`${line}: ${spec} の行き先の入口に ${missing.join("・")} が無い(入口に足すか手で直す)`);
      continue;
    }
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
    for (const ns of nsEdits) for (const u of ns.uses) edits.push([u.index, u.index + u[0].length, ns.finalName(u[1])]);
    for (const [from, to] of renames) {
      const re = new RegExp(`(?<![\\w$.'"\`/-])${from}(?![\\w$'"\`])`, "g");
      for (const u of text.matchAll(re)) {
        if (u.index >= m.index && u.index < end) continue;
        if (/[{,]\s*$/.test(text.slice(Math.max(0, u.index - 20), u.index)) && /^\s*:(?!:)/.test(text.slice(u.index + from.length))) continue;
        edits.push([u.index, u.index + from.length, to]);
      }
    }
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
    } else if (splitOf(r.mod)) {
      handled.push([m.index, m.index + whole.length]);
      stops.push(`${line}: ${spec} に default はない(手で直す)`);
    } else if (moved && missingIn(target, ["default"]).length) {
      handled.push([m.index, m.index + whole.length]);
      stops.push(`${line}: ${spec} → ${specOf(spec, target)} の入口に default が無い(手で直す)`);
    }
  }

  // 1c. `import * as M from "…"`(分けるモジュールの名前空間の import)
  const STAR = /\bimport\s+\*\s+as\s+([\w$]+)\s+from\s*(["'])([^"'\n]+)\2(\s*;)?/g;
  for (const m of text.matchAll(STAR)) {
    const [whole, local, quote, spec, semi] = m;
    const r = resolveSpecifier(fromFile, spec);
    if (!r || !splitOf(r.mod)) continue;
    const line = lineOf(text, m.index);
    handled.push([m.index, m.index + whole.length]);
    if (splitOf(r.mod).rest === "stay") {
      if (needsHand(splitOf(r.mod), text)) hands.push(`${line}: ${spec} の import * as(残る名前もあるので手で分ける)`);
      continue;
    }
    bound.delete(local);
    const ns = namespaceEdits(local, r.mod, line);
    if (!ns) continue;
    const groups = new Map();
    addNamespaceMembers(groups, ns, splitOf(r.mod), "import", false);
    const stmts = [...groups].map(([unit, g]) => statementFor("import", false, quote, specOf(spec, unit), semi, g));
    edits.push([m.index, m.index + whole.length, stmts.join("\n")]);
    for (const u of ns.uses) edits.push([u.index, u.index + u[0].length, ns.finalName(u[1])]);
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
    if (splitOf(r.mod)) {
      if (needsHand(splitOf(r.mod), text)) hands.push(`${line}: ${spec} は名前ごとに行き先が分かれた(export *・mock.module・import()・文字列は手で行き先へ)`);
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
    if (!dm) {
      const gone = DIR_GONE.find((d) => file.startsWith(`${d.from}/`));
      if (gone) stops.push({ file, line: 0, text: gone.reason });
      continue;
    }
    const to = `${dm.to}${file.slice(dm.from.length)}`;
    if (existsSync(path.join(root, to))) stops.push({ file, line: 0, text: `${to} がある(名前を変えてから走らせ直す)` });
    else moves.push({ from: file, to });
  }
  const fileSet = new Set(files);
  /** モジュールの道 → その入口のファイル(無ければ null) */
  const fileOf = (mod) => {
    for (const ext of [".ts", ".tsx", ".mts", ".mjs", ".js", ".jsx"]) {
      if (fileSet.has(`${mod}${ext}`)) return `${mod}${ext}`;
      if (fileSet.has(`${mod}/index${ext}`)) return `${mod}/index${ext}`;
    }
    return null;
  };
  const exportsCache = new Map();
  const reader = (file) => ({
    path: file,
    text: read(file) ?? "",
    readRelative: (spec) => {
      const target = fileOf(resolveSpecifier(file, spec)?.mod ?? "");
      return target ? reader(target) : null;
    },
  });
  const exportsOf = (mod) => {
    if (!exportsCache.has(mod)) {
      const file = fileOf(mod);
      exportsCache.set(mod, file ? exportsOfText(read(file) ?? "", reader(file).readRelative, new Set([file])) : null);
    }
    return exportsCache.get(mod);
  };

  const rewrites = [];
  const hands = [];
  for (const file of files) {
    if (!(file.startsWith("src/") || file.startsWith("scripts/"))) continue;
    if (CODE.test(file)) {
      const text = read(file);
      if (text == null) continue;
      const moved = moves.find((mv) => mv.from === file);
      const res = rewriteSource(file, text, { emitFrom: moved?.to, exists: (mod) => mods.has(mod), exportsOf });
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
