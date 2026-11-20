#!/usr/bin/env node
// .notices/20261120-150000-shelf-s1.places.mjs
// 部品の棚の場所の整理(区切り shelf-s1)に fork のコードを合わせる移行。fork のリポのルートで走らせる。
// 使い方: node .notices/20261120-150000-shelf-s1.places.mjs [--apply]
//   既定は dry-run(書き換える指定・動かすファイル・止める所・手で直す所の一覧を出すだけ)。--apply で書く。何度走らせても同じ結果。
//
// 上流で変わったこと:
// - 棚の 8 つの入口(src/components/<TextBlocks|Navigation|Badge|Layout|Icons|Widgets|Animation|Functional>/index)を消した。
//   部品はそれを定義するファイル(@/components/<Category>/<Unit>)から読む
// - Layout の spacing・spacingScale・spacingClasses.generated → 閉じた lib @/lib/spacing、commonVariants → Layout/appearance
// - AppFrames/Kiosk → Layout/KioskFrame、Functional/BodyPortal → Overlays/BodyPortal、@/hooks/useHeaderHeight → @/app/_layout/useHeaderHeight、
//   AppFrames/Admin/Elements/* → components/Admin/*
// - Layout/FullScreen は名前付きの export だけ(default を外した)
// - 消したもの(代わりなし): Layout/Hidden、Functional/HeadPortal、components/Three
//
// することは 3 つ:
// 1. src・scripts のコード(.ts / .tsx / .mts / .mjs / .js / .jsx、git の管理下)の指定(@/… と相対の …)を書き換える
//    - 入口からの `import|export [type] { … } from` は、名前ごとに定義元のファイルへ 1 文ずつ分ける(type・as はそのまま)
//    - 動いた場所の指定は行き先に(@/ は @/ のまま、相対は相対のまま。@/lib/spacing は閉じた lib なので常に @/lib/spacing)
//    - FullScreen の default の import / re-export は名前付きに
// 2. fork が足した src/components/AppFrames/Admin/Elements の下のファイルを src/components/Admin の同じ名へ git mv
//    (中の相対の指定は新しい場所から引き直す)。行き先に同じ名があれば止める
// 3. 機械では直せない所を一覧に出す: 消したものを読む所・表にない名前(STOP)、入口や FullScreen を指す mock.module・import()・
//    export * ・その他の文字列、JSON・Markdown の旧パスの字面(hand)
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

const LIB_SPACING = "src/lib/spacing";
const FULLSCREEN = "src/components/Layout/FullScreen";
const C = "src/components";

/** 入口ごとに、定義元のファイル(モジュールの道、拡張子と /index なし) → そこから読む名前。`default:X` = default export の X */
const ENTRY_UNITS = {
  [`${C}/TextBlocks`]: {
    [`${C}/Layout/Main`]: ["Main", "MainProps"],
    [`${C}/TextBlocks/PageTitle`]: ["PageTitle", "PageTitleProps"],
    [`${C}/TextBlocks/SecTitle`]: ["SecTitle", "SecTitleProps"],
    [`${C}/TextBlocks/Para`]: ["Para", "ParaProps"],
    [`${C}/TextBlocks/Span`]: ["Span", "SpanProps"],
  },
  [`${C}/Navigation`]: {
    [`${C}/Navigation/Link`]: ["Link", "LinkVisibilityProvider", "LinkGate", "LinkHiddenJudge", "LinkProps"],
    [`${C}/Navigation/PageTab`]: ["SolidTabs", "UnderlineTabs", "useActiveTab", "TAB_SIZE_STYLES", "PageTabItem", "PageTabMatcher", "PageTabSize"],
    [`${C}/Navigation/StateTabs`]: ["StateTabs", "StateTabsContent", "StateTabItem", "StateTabSize"],
    [`${C}/Navigation/Pagination`]: ["default:Pagination", "PaginationProps"],
    [`${C}/Navigation/NavigationPort`]: [
      "NavigationPortProvider",
      "useNavigationPort",
      "useShelfRouter",
      "useShelfUnsavedSource",
      "NavigationPortValue",
      "ShelfLinkJudge",
      "ShelfRouter",
      "ShelfUnsavedSource",
    ],
  },
  [`${C}/Badge`]: {
    [`${C}/Badge/badge-variants`]: ["badgeSizeStyles", "BadgeVariant", "BadgeSize", "BadgeVariantStyles"],
    [`${C}/Badge/SolidBadge`]: ["SolidBadge", "SolidBadgeProps"],
    [`${C}/Badge/SoftBadge`]: ["SoftBadge", "SoftBadgeProps"],
    [`${C}/Badge/BookmarkTagBadge`]: ["BookmarkTagBadge", "BookmarkTagBadgeProps"],
  },
  [`${C}/Layout`]: {
    [`${C}/Layout/Block`]: ["Block"],
    [`${C}/Layout/Flex`]: ["Flex"],
    [FULLSCREEN]: ["FullScreen"],
    [`${C}/Layout/Grid`]: ["Grid"],
    [`${C}/Layout/InBlock`]: ["InBlock"],
    [`${C}/Layout/Main`]: ["Main"],
    [`${C}/Layout/ScaledStage`]: ["ScaledStage", "ScaledStageProps"],
    [`${C}/Layout/Section`]: ["Section"],
    [`${C}/Layout/Stack`]: ["Stack"],
    [LIB_SPACING]: ["BoxSpacingProps", "SpacingBreakpoint", "SpacingName", "SpacingValue"],
  },
  [`${C}/Icons`]: {
    [`${C}/Icons/types`]: ["CustomIconProps", "CustomIcon", "IconComponent"],
    [`${C}/Icons/createImageIcon`]: ["createImageIcon"],
    [`${C}/Icons/createSvgIcon`]: ["createSvgIcon"],
    [`${C}/Icons/definitions`]: ["FileIcon"],
  },
  [`${C}/Widgets`]: {
    [`${C}/Widgets/ScrollSlider`]: ["ScrollSlider", "ScrollSliderProps", "ScrollSlideState", "ResponsiveSlideSize"],
    [`${C}/Widgets/FadeSlider`]: ["FadeSlider", "FadeSliderProps", "FadeSlideState", "FadeTransition"],
    [`${C}/Widgets/InfiniteScrollList`]: ["InfiniteScrollList", "InfiniteScrollListProps"],
    [`${C}/Widgets/_shared/SliderArrow`]: ["SliderArrow"],
    [`${C}/Widgets/_shared/SliderDots`]: ["SliderDots"],
    [`${C}/Widgets/_shared/types`]: [
      "ArrowVariant",
      "ArrowSize",
      "ArrowPosition",
      "RenderArrowProps",
      "DotVariant",
      "DotPosition",
      "RenderDotsProps",
      "ResponsiveToggle",
      "AutoplayOption",
      "MaskOption",
      "TransitionTiming",
      "SliderControlProps",
      "SliderImperativeApi",
      "SliderA11yProps",
      "RenderItem",
    ],
  },
  [`${C}/Animation`]: {
    [`${C}/Animation/CountUp`]: ["CountUp"],
    [`${C}/Animation/PageTransition`]: ["PageTransition"],
  },
  [`${C}/Functional`]: {
    [`${C}/Overlays/BodyPortal`]: ["BodyPortal"],
    [`${C}/Functional/DarkModeSwitch`]: ["DarkModeSwitch"],
    [`${C}/Functional/FirebaseAnalytics`]: ["FirebaseAnalytics"],
  },
};

/** 入口から読めた名前のうち消したもの(代わりなし) */
const DELETED_NAMES = { [`${C}/Layout`]: ["Hidden"], [`${C}/Functional`]: ["HeadPortal"] };

/** 動いたモジュール。prefix = その下も同じ相対の道で動いた */
const MOVES = [
  { from: `${C}/Layout/spacing`, to: LIB_SPACING },
  { from: `${C}/Layout/spacingScale`, to: LIB_SPACING },
  { from: `${C}/Layout/spacingClasses.generated`, to: LIB_SPACING },
  { from: `${C}/Layout/commonVariants`, to: `${C}/Layout/appearance` },
  { from: `${C}/AppFrames/Kiosk`, to: `${C}/Layout/KioskFrame` },
  { from: `${C}/AppFrames/Kiosk/KioskFrame`, to: `${C}/Layout/KioskFrame` },
  { from: `${C}/Functional/BodyPortal`, to: `${C}/Overlays/BodyPortal` },
  { from: "src/hooks/useHeaderHeight", to: "src/app/_layout/useHeaderHeight" },
  { from: `${C}/AppFrames/Admin/Elements`, to: `${C}/Admin`, prefix: true },
];

/** 消したモジュール(代わりなし) */
const DELETED = [
  { from: `${C}/Layout/Hidden` },
  { from: `${C}/Functional/HeadPortal` },
  { from: `${C}/Three`, prefix: true },
];

/** fork が足したファイルを動かすフォルダ */
const DIR_MOVES = [{ from: `${C}/AppFrames/Admin/Elements`, to: `${C}/Admin` }];
/** fork が足したファイルが残っていたら止めるフォルダ(行き先が 1 本のファイルになった) */
const DIR_GONE = [{ from: `${C}/AppFrames/Kiosk`, reason: "Kiosk は src/components/Layout/KioskFrame.tsx 1 本になった(fork のファイルは手で置き直す)" }];

/** JSON・Markdown で旧パスとみなす字面 */
const DOC_PATTERNS = [
  /components\/(TextBlocks|Navigation|Badge|Layout|Icons|Widgets|Animation|Functional)(?![\w/-]|\.\w)/,
  /components\/Layout\/(spacing|spacingScale|spacingClasses\.generated|commonVariants|Hidden)(?![\w-])/,
  /components\/AppFrames\/(Kiosk|Admin\/Elements)/,
  /components\/Functional\/(BodyPortal|HeadPortal)/,
  /hooks\/useHeaderHeight/,
  /components\/Three(?![\w-])/,
];

const ENTRY_NAMES = {};
for (const [entry, units] of Object.entries(ENTRY_UNITS)) {
  ENTRY_NAMES[entry] = {};
  for (const [unit, names] of Object.entries(units)) {
    for (const n of names) {
      const isDefault = n.startsWith("default:");
      ENTRY_NAMES[entry][isDefault ? n.slice(8) : n] = { unit, isDefault };
    }
  }
}

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

/** 動いた / 消したモジュールなら { kind, to }。どちらでもなければ null */
export function mapModule(mod) {
  for (const d of DELETED) if (d.prefix ? under(mod, d.from) : mod === d.from) return { kind: "deleted" };
  for (const m of MOVES) {
    if (mod === m.from) return { kind: "moved", to: m.to, prefix: !!m.prefix };
    if (m.prefix && mod.startsWith(`${m.from}/`)) return { kind: "moved", to: `${m.to}${mod.slice(m.from.length)}`, prefix: true };
  }
  return null;
}

/** モジュールの道を指定に戻す。元の指定の形(@/ か相対か)を保つ。@/lib/spacing は閉じた lib なので常に @/lib/spacing */
export function emitSpecifier(origSpec, emitFrom, mod, suffix = "") {
  if (under(mod, LIB_SPACING)) return "@/lib/spacing";
  if (origSpec.startsWith("@/") || origSpec.startsWith("src/")) return `@/${mod.slice(4)}${suffix}`;
  let rel = P.relative(P.dirname(emitFrom), mod);
  if (!rel.startsWith(".")) rel = `./${rel}`;
  return `${rel}${suffix}`;
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

/** 入口の部品のファイルを fork の木から探す(表にない名前、fork が足したアイコンなど)。1 本に決まればそのモジュール、ほかは null */
function makeExportLookup(files, readFile) {
  const cache = new Map();
  return (entry, name) => {
    if (!cache.has(entry)) {
      const map = new Map();
      for (const file of files) {
        if (!file.startsWith(`${entry}/`) || !CODE.test(file) || /\.test\.|__fixtures__|\.d\.ts$/.test(file)) continue;
        const mod = resolveSpecifier(file, `./${P.basename(file)}`).mod;
        if (mod === entry) continue;
        const text = readFile(file);
        if (text == null) continue;
        const names = new Set();
        for (const m of text.matchAll(/^export\s+(?:declare\s+)?(?:default\s+)?(?:async\s+)?(?:const|let|var|function\*?|class|type|interface|enum)\s+([\w$]+)/gm)) names.add(m[1]);
        for (const m of text.matchAll(/^export\s+(?:type\s+)?\{([^}]*)\}/gm)) {
          for (const it of parseItems(m[1]) ?? []) names.add(it.alias ?? it.name);
        }
        for (const n of names) {
          if (!map.has(n)) map.set(n, []);
          map.get(n).push(mod);
        }
      }
      cache.set(entry, map);
    }
    const mods = cache.get(entry).get(name) ?? [];
    if (mods.length === 0) return null;
    const shortest = Math.min(...mods.map((m) => m.split("/").length));
    const top = [...new Set(mods.filter((m) => m.split("/").length === shortest))];
    return top.length === 1 ? top[0] : null;
  };
}

/**
 * 1 本のコードのファイルの中身を書き換える。
 * @param {string} fromFile いまの場所(相対の指定はここから解く)
 * @param {string} text 中身
 * @param {{ emitFrom?: string, lookup?: (entry: string, name: string) => string | null, exists?: (mod: string) => boolean }} [opts]
 *   emitFrom = 書き出す場所(動かすファイルなら行き先)。lookup = 表にない名前の定義元。exists = その道のモジュールが木にあるか
 * @returns {{ text: string, hits: string[], stops: string[], hands: string[] }} hits・stops・hands は `<行>: <内容>`
 */
export function rewriteSource(fromFile, text, opts = {}) {
  const emitFrom = opts.emitFrom ?? fromFile;
  const relocating = emitFrom !== fromFile;
  const lookup = opts.lookup ?? (() => null);
  const exists = opts.exists ?? (() => false);
  const edits = [];
  const handled = [];
  const hits = [];
  const stops = [];
  const hands = [];
  const isHandled = (i) => handled.some(([s, e]) => i >= s && i < e);
  const specOf = (orig, mod, suffix) => emitSpecifier(orig, emitFrom, mod, suffix);
  /** 動いていない指定も、ファイルを動かすなら相対を引き直す */
  const keepSpec = (orig, r) => (relocating && !orig.startsWith("@/") && !orig.startsWith("src/") ? specOf(orig, r.mod, r.suffix) : orig);

  // 1. 入口・FullScreen・消したものを読む `import|export [type] [X,] { … } from "…"`
  const BRACE = /\b(import|export)(\s+type)?\s+(?:([\w$]+)\s*,\s*)?\{([^}]*)\}\s*from\s*(["'])([^"'\n]+)\5(\s*;)?/g;
  for (const m of text.matchAll(BRACE)) {
    const [whole, kw, stmtType, defaultLocal, body, quote, spec, semi] = m;
    const r = resolveSpecifier(fromFile, spec);
    if (!r) continue;
    const line = lineOf(text, m.index);
    const end = m.index + whole.length;
    const isEntry = !!ENTRY_UNITS[r.mod];
    const mapped = mapModule(r.mod);
    if (!isEntry && r.mod !== FULLSCREEN && mapped?.kind !== "deleted") continue;
    handled.push([m.index, end]);
    if (mapped?.kind === "deleted") {
      stops.push(`${line}: ${spec} は消した(代わりなし。使う所を手で直す)`);
      continue;
    }
    const items = parseItems(body);
    if (!items) {
      hands.push(`${line}: ${spec} の import の中身が読めない(手で分ける)`);
      continue;
    }
    const sc = semi ? ";" : "";
    const ty = stmtType ? " type" : "";
    if (r.mod === FULLSCREEN) {
      let changed = false;
      const out = items.map((it) => {
        if (it.name !== "default") return it;
        changed = true;
        return { ...it, name: "FullScreen", alias: it.alias === "FullScreen" ? null : it.alias };
      });
      if (defaultLocal) {
        changed = true;
        out.unshift({ type: false, name: "FullScreen", alias: defaultLocal === "FullScreen" ? null : defaultLocal });
      }
      const nextSpec = keepSpec(spec, r);
      if (!changed && nextSpec === spec) continue;
      const next = `${kw}${ty} { ${out.map(itemText).join(", ")} } from ${quote}${nextSpec}${quote}${sc}`;
      edits.push([m.index, end, next]);
      if (changed) hits.push(`${line}: FullScreen の default → 名前付き`);
      continue;
    }
    // 入口: 名前ごとに定義元へ
    if (defaultLocal) {
      stops.push(`${line}: ${spec} に default はない(手で直す)`);
      continue;
    }
    const groups = new Map();
    const bad = [];
    for (const it of items) {
      if ((DELETED_NAMES[r.mod] ?? []).includes(it.name)) {
        bad.push(`${it.name} は消した(代わりなし)`);
        continue;
      }
      let hit = ENTRY_NAMES[r.mod][it.name];
      if (!hit) {
        const found = lookup(r.mod, it.name);
        if (found) hit = { unit: found, isDefault: false };
      }
      if (!hit) {
        bad.push(`${it.name} の定義元が見つからない`);
        continue;
      }
      if (!groups.has(hit.unit)) groups.set(hit.unit, { def: null, named: [] });
      const g = groups.get(hit.unit);
      if (hit.isDefault && kw === "import" && !stmtType && !it.type) g.def = it.alias ?? it.name;
      else if (hit.isDefault) g.named.push({ type: it.type, name: "default", alias: it.alias ?? it.name });
      else g.named.push(it);
    }
    if (bad.length) {
      stops.push(`${line}: ${spec} の ${bad.join("・")}(手で直す)`);
      continue;
    }
    const stmts = [];
    for (const [unit, g] of groups) {
      const nextSpec = specOf(spec, unit, "");
      const parts = [];
      if (g.def) parts.push(g.def);
      if (g.named.length) parts.push(`{ ${g.named.map(itemText).join(", ")} }`);
      stmts.push(`${kw}${ty} ${parts.join(", ")} from ${quote}${nextSpec}${quote}${sc}`);
    }
    edits.push([m.index, end, stmts.join("\n")]);
    hits.push(`${line}: ${spec} → ${[...groups.keys()].map((u) => specOf(spec, u, "")).join(", ")}`);
  }

  // 1b. `import [type] X from "…"`(FullScreen の default、入口・消したもの)
  const DEFAULT = /\bimport(\s+type)?\s+([\w$]+)\s+from\s*(["'])([^"'\n]+)\3(\s*;)?/g;
  for (const m of text.matchAll(DEFAULT)) {
    if (isHandled(m.index)) continue;
    const [whole, stmtType, local, quote, spec, semi] = m;
    if (local === "type") continue;
    const r = resolveSpecifier(fromFile, spec);
    if (!r) continue;
    const line = lineOf(text, m.index);
    const mapped = mapModule(r.mod);
    if (r.mod === FULLSCREEN) {
      handled.push([m.index, m.index + whole.length]);
      const it = { type: false, name: "FullScreen", alias: local === "FullScreen" ? null : local };
      edits.push([m.index, m.index + whole.length, `import${stmtType ? " type" : ""} { ${itemText(it)} } from ${quote}${keepSpec(spec, r)}${quote}${semi ? ";" : ""}`]);
      hits.push(`${line}: FullScreen の default → 名前付き`);
    } else if (ENTRY_UNITS[r.mod]) {
      handled.push([m.index, m.index + whole.length]);
      stops.push(`${line}: ${spec} に default はない(手で直す)`);
    } else if (mapped?.kind === "deleted") {
      handled.push([m.index, m.index + whole.length]);
      stops.push(`${line}: ${spec} は消した(代わりなし。使う所を手で直す)`);
    }
  }

  // 2. 残りの文字列の指定: 動いたものは書き換え、入口・FullScreen は手で、消したものは止める
  const LITERAL = /(["'`])([^"'`\n]+)\1/g;
  for (const m of text.matchAll(LITERAL)) {
    if (isHandled(m.index)) continue;
    const [, quote, spec] = m;
    if (spec.includes("${")) continue;
    const r = resolveSpecifier(fromFile, spec);
    if (!r) continue;
    const line = lineOf(text, m.index);
    const mapped = mapModule(r.mod);
    const isPlainPath = spec.startsWith("src/");
    if (mapped?.kind === "deleted") {
      stops.push(`${line}: ${spec} は消した(代わりなし。使う所を手で直す)`);
    } else if (ENTRY_UNITS[r.mod]) {
      hands.push(`${line}: ${spec} は消した入口(mock.module・import()・export *・文字列は手で部品のファイルへ)`);
    } else if (r.mod === FULLSCREEN) {
      if (!isPlainPath) hands.push(`${line}: ${spec} の FullScreen は名前付きだけになった(default を読む所は手で直す)`);
    } else if (mapped?.kind === "moved") {
      if (isPlainPath) {
        hands.push(`${line}: ${spec} は ${mapped.to} へ動いた(道の文字列は手で直す)`);
        continue;
      }
      const next = specOf(spec, mapped.to, mapped.prefix ? r.suffix : "");
      edits.push([m.index, m.index + m[0].length, `${quote}${next}${quote}`]);
      hits.push(`${line}: ${spec} → ${next}`);
    } else if (relocating && !spec.startsWith("@/") && !isPlainPath && exists(r.mod)) {
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

const isEntryFile = (file) => {
  const r = resolveSpecifier(file, `./${P.basename(file)}`);
  return r.suffix.startsWith("/index") && !!ENTRY_UNITS[r.mod];
};

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
  const lookup = makeExportLookup(files, read);

  const moves = [];
  const stops = [];
  for (const file of files) {
    const dm = DIR_MOVES.find((d) => file.startsWith(`${d.from}/`));
    if (dm) {
      const to = `${dm.to}${file.slice(dm.from.length)}`;
      if (existsSync(path.join(root, to))) stops.push({ file, line: 0, text: `${to} がある(名前を変えてから走らせ直す)` });
      else moves.push({ from: file, to });
    }
    const gone = DIR_GONE.find((d) => file.startsWith(`${d.from}/`));
    if (gone) stops.push({ file, line: 0, text: gone.reason });
  }

  const rewrites = [];
  const hands = [];
  for (const file of files) {
    if (!(file.startsWith("src/") || file.startsWith("scripts/"))) continue;
    if (CODE.test(file)) {
      if (isEntryFile(file)) continue;
      const text = read(file);
      if (text == null) continue;
      const moved = moves.find((mv) => mv.from === file);
      const res = rewriteSource(file, text, { emitFrom: moved?.to, lookup, exists: (mod) => mods.has(mod) });
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
