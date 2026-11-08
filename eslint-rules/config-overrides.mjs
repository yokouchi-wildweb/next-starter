// eslint-rules/config-overrides.mjs
//
// 上書きファイル(src/config/{lib,features,layout,proxies}/<名前>.config.ts と <名前>.ui.config.ts)の 2 つの規則(設定 D34・D35・D38・L1.19)。
// 全 Tier error(新しいフォルダだけが対象なので縮む表は無い)。置き方の決まり: src/config/README.md
//
// - literal-only(上書きファイルに掛ける): 値はリテラルだけ。読んでよいのは
//     型だけの import、process.env、@/business の値、@/lib/appEnv の段階の判定の引数なしの呼び出し(isProduction() など、設定 D87)、
//     持ち主が自分の config.ts(描画用の上書きは config.ui.ts)で `export const overrideImports = [...] as const` と宣言した指定子(前方一致)の値。
//   ファイルの文は import・export default・型の宣言(export type Extra など)だけ。関数・呼び出し・new・変数・export const は書けない。
//   値の中で許す式: object / array(spread・計算されたキー・メソッド無し)・文字列 / 数 / 真偽 / null / undefined・式の無い template・
//   単項の - + !・as const・satisfies・process.env.<名前>・許した import の名前とその . の先・比較(=== !== == !=)と ?? || &&・条件式(env で切り替える)。
//   宣言は持ち主のファイルにだけ効く(上書きの中に overrideImports を書いても広がらない)。
// - owner-reads-only(src と scripts の全ファイルに掛ける): 上書きを読めるのは持ち主の config.ts(<名前>.ui.config.ts は config.ui.ts)だけ。
//   @/config/… ・相対・"src/…"・@lib-config/<名前> のどれで読んでも解いた実パスで判定し、型だけの import も止める。
//   lib の中から自分の上書きを読む所は lint lib-entry の持ち分なので見ない(二重に落とさない)。
//
// 上書き → 持ち主は地区の地図(src/lib/districtMap)で引く(リポジトリごとに 1 回読んで覚える。地区を足したら eslint を起動し直す)。
// 持ち主の宣言の本文は毎回読む。

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { OVERRIDE_FOLDERS, OVERRIDE_ROOT, readOverrideImports } from "../src/lib/districtMap/index.mjs";
import { readDistrictMapAt } from "../src/lib/districtMap/node.mjs";
import { moduleVisitors, repoRelative, resolveImport } from "./resolve-import.mjs";

const FOLDERS = Object.values(OVERRIDE_FOLDERS);
const OVERRIDE_PATH = new RegExp(`^${OVERRIDE_ROOT}/(${FOLDERS.join("|")})/[^/]+\\.config(\\.ts)?$`);
const BUSINESS = "@/business";
/** 段階の判定(本部 D178 の読み手、設定 D87)。引数なしの呼び出しだけを値として許す */
const APP_ENV = "@/lib/appEnv";
const STAGE_FUNCTIONS = new Set(["isProduction", "isStaging", "isDevelopment", "getAppEnv"]);

const mapCache = new Map();

/** 上書きのパス(拡張子つき)→ { district, ui, owner }。owner = 持ち主の config.ts か config.ui.ts のパス */
function overrideSlots(root) {
  if (mapCache.has(root)) return mapCache.get(root);
  const slots = new Map();
  for (const d of readDistrictMapAt(root).districts) {
    slots.set(d.override.path, { district: d, ui: false, owner: d.config.path });
    slots.set(d.uiOverride.path, { district: d, ui: true, owner: d.uiConfig.path });
  }
  mapCache.set(root, slots);
  return slots;
}

/** テスト用: 覚えた地図を捨てる */
export function clearConfigOverridesCache() {
  mapCache.clear();
}

/** 解いた実パス(拡張子の有無を問わない)が上書きファイルなら、拡張子つきの repo 相対パス */
function asOverridePath(resolved) {
  if (!resolved || !OVERRIDE_PATH.test(resolved)) return null;
  return resolved.endsWith(".ts") ? resolved : `${resolved}.ts`;
}

const rootOf = (context) => context.options?.[0]?.root ?? context.cwd;
const stripExt = (p) => p.replace(/\.(ts|tsx|mts|mjs|js)$/, "");
const matchesPrefix = (specifier, prefixes) => prefixes.some((p) => specifier === p || specifier.startsWith(p.endsWith("/") ? p : `${p}/`));

/** 持ち主の宣言(overrideImports)。持ち主のファイルが無ければ [] */
function declaredImports(root, ownerPath) {
  const abs = path.join(root, ownerPath);
  if (!existsSync(abs)) return [];
  return readOverrideImports(ownerPath, readFileSync(abs, "utf8")).imports;
}

const TS_WRAPPERS = new Set(["TSAsExpression", "TSSatisfiesExpression", "TSNonNullExpression", "TSTypeAssertion"]);
const COMPARE = new Set(["===", "!==", "==", "!="]);

/** process.env(の読み) */
function isProcessEnv(node) {
  return node.type === "MemberExpression" && !node.computed && node.property.name === "env" && node.object.type === "Identifier" && node.object.name === "process";
}

/**
 * 値の式を確かめる。許さない所の node を返す(全部よければ null)
 * @param {Set<string>} allowedNames 値として読める import の名前
 * @param {Set<string>} [stageNames] 引数なしで呼べる段階の判定の名前(@/lib/appEnv)
 */
function firstNonLiteral(node, allowedNames, stageNames = new Set()) {
  const next = (n) => firstNonLiteral(n, allowedNames, stageNames);
  if (!node) return null;
  if (TS_WRAPPERS.has(node.type)) return next(node.expression);
  switch (node.type) {
    case "Literal":
      return node.regex ? node : null;
    case "TemplateLiteral":
      return node.expressions.length === 0 ? null : node;
    case "UnaryExpression":
      return ["-", "+", "!"].includes(node.operator) ? next(node.argument) : node;
    case "ArrayExpression":
      for (const element of node.elements) {
        if (element === null) continue;
        if (element.type === "SpreadElement") return element;
        const bad = next(element);
        if (bad) return bad;
      }
      return null;
    case "ObjectExpression":
      for (const property of node.properties) {
        if (property.type !== "Property" || property.computed || property.method || property.kind !== "init") return property;
        const bad = next(property.value);
        if (bad) return bad;
      }
      return null;
    case "Identifier":
      return node.name === "undefined" || allowedNames.has(node.name) ? null : node;
    case "MemberExpression": {
      // process.env.X / process.env["X"]
      if (isProcessEnv(node.object)) return !node.computed || (node.property.type === "Literal" && typeof node.property.value === "string") ? null : node;
      // 許した import の名前の . の先(business.email・Icons.Wallet)
      let base = node;
      while (base.type === "MemberExpression" && !base.computed) base = base.object;
      return base.type === "Identifier" && allowedNames.has(base.name) ? null : node;
    }
    case "CallExpression":
      // 段階の判定(isProduction() など)だけ。引数あり・他の関数は止める
      return node.callee.type === "Identifier" && stageNames.has(node.callee.name) && node.arguments.length === 0 && !node.optional ? null : node;
    case "BinaryExpression":
      if (!COMPARE.has(node.operator)) return node;
      return next(node.left) ?? next(node.right);
    case "LogicalExpression":
      return next(node.left) ?? next(node.right);
    case "ConditionalExpression":
      return next(node.test) ?? next(node.consequent) ?? next(node.alternate);
    default:
      return node;
  }
}

const isTypeDeclaration = (node) => node && ["TSTypeAliasDeclaration", "TSInterfaceDeclaration"].includes(node.type);

const literalOnly = {
  meta: {
    type: "problem",
    docs: { description: "上書きファイルは値のリテラルだけ(読めるのは process.env・@/business・持ち主が宣言した指定子、src/config/README.md)" },
    schema: [{ type: "object", properties: { root: { type: "string" } }, additionalProperties: false }],
    messages: {
      noOwner: "{{file}}: 持ち主の地区が無い上書き。pnpm check config-overrides で直し方を見る(src/config/README.md)",
      valueImport:
        '"{{source}}": 上書きで値として読めるのは @/business と、持ち主 {{owner}} が overrideImports で宣言した指定子だけです。型は import type で読みます(src/config/README.md)',
      sideEffect: '"{{source}}": 上書きに副作用の import は書けません',
      stageImport: "@/lib/appEnv から上書きで読めるのは段階の判定 {{names}} だけです(引数なしで呼ぶ、設定 D87)",
      statement: "上書きのファイルに書けるのは import・export default・型の宣言(export type Extra など)だけです。値は export default の中にリテラルで書きます",
      nonLiteral: "上書きの値はリテラルだけです(関数・呼び出し・new・変数・式の template は書けない。読めるのは process.env・@/business・段階の判定 isProduction() など・宣言した import)",
      noDefault: "上書きは export default で値を 1 つ出します(空なら export default {} satisfies <持ち主の上書きの型>)",
    },
  },
  create(context) {
    const root = rootOf(context);
    const file = repoRelative(context.filename, root);
    if (!OVERRIDE_PATH.test(file)) return {};
    const slot = overrideSlots(root).get(file);
    return {
      Program(program) {
        if (!slot) {
          context.report({ node: program, messageId: "noOwner", data: { file } });
          return;
        }
        const declared = declaredImports(root, slot.owner);
        const allowedNames = new Set();
        const stageNames = new Set();
        let hasDefault = false;
        for (const statement of program.body) {
          if (statement.type === "ImportDeclaration") {
            const source = statement.source.value;
            const typeOnly =
              statement.importKind === "type" ||
              (statement.specifiers.length > 0 && statement.specifiers.every((s) => s.type === "ImportSpecifier" && s.importKind === "type"));
            if (typeOnly) continue;
            if (statement.specifiers.length === 0) {
              context.report({ node: statement, messageId: "sideEffect", data: { source } });
              continue;
            }
            if (source === APP_ENV) {
              const bad = statement.specifiers.find((sp) => !(sp.type === "ImportSpecifier" && (sp.importKind === "type" || STAGE_FUNCTIONS.has(sp.imported.name))));
              if (bad) {
                context.report({ node: bad, messageId: "stageImport", data: { names: [...STAGE_FUNCTIONS].join("・") } });
                continue;
              }
              for (const sp of statement.specifiers) if (sp.importKind !== "type") stageNames.add(sp.local.name);
              continue;
            }
            if (source === BUSINESS || source.startsWith(`${BUSINESS}/`) || matchesPrefix(source, declared)) {
              for (const s of statement.specifiers) if (!(s.type === "ImportSpecifier" && s.importKind === "type")) allowedNames.add(s.local.name);
              continue;
            }
            context.report({ node: statement.source, messageId: "valueImport", data: { source, owner: slot.owner } });
            // 読んだ名前の使い所は二重に落とさない(直すのは import の側)
            for (const s of statement.specifiers) allowedNames.add(s.local.name);
            continue;
          }
          if (statement.type === "ExportDefaultDeclaration") {
            hasDefault = true;
            const bad = firstNonLiteral(statement.declaration, allowedNames, stageNames);
            if (bad) context.report({ node: bad, messageId: "nonLiteral" });
            continue;
          }
          if (isTypeDeclaration(statement)) continue;
          if (statement.type === "ExportNamedDeclaration" && (statement.exportKind === "type" || isTypeDeclaration(statement.declaration))) continue;
          context.report({ node: statement, messageId: "statement" });
        }
        if (!hasDefault) context.report({ node: program, messageId: "noDefault" });
      },
    };
  },
};

const ownerReadsOnly = {
  meta: {
    type: "problem",
    docs: { description: "上書きファイルを読めるのは持ち主の config.ts(描画用は config.ui.ts)だけ(src/config/README.md)" },
    schema: [{ type: "object", properties: { root: { type: "string" } }, additionalProperties: false }],
    messages: {
      notOwner: '"{{source}}": 上書き {{override}} を読めるのは持ち主の {{owner}} だけです。値は持ち主の入口から確定した物を読みます(src/config/README.md)',
      noOwner: '"{{source}}": {{override}} は持ち主の地区が無い上書きです(pnpm check config-overrides)',
    },
  },
  create(context) {
    const root = rootOf(context);
    const file = repoRelative(context.filename, root);
    return moduleVisitors(({ node, source }) => {
      const override = asOverridePath(resolveImport(source, context.filename, root));
      if (!override) return;
      const slot = overrideSlots(root).get(override);
      if (!slot) {
        context.report({ node, messageId: "noOwner", data: { source, override } });
        return;
      }
      if (stripExt(file) === stripExt(slot.owner)) return;
      // lib の中から自分の上書きを読む所は lint lib-entry(@lib-config/<自分> だけ)の持ち分
      if (slot.district.kind === "lib" && file.startsWith(`${slot.district.dir}/`)) return;
      context.report({ node, messageId: "notOwner", data: { source, override, owner: slot.owner } });
    });
  },
};

const plugin = {
  meta: { name: "eslint-plugin-local-config-overrides", version: "1.0.0" },
  rules: { "literal-only": literalOnly, "owner-reads-only": ownerReadsOnly },
};

export default plugin;
