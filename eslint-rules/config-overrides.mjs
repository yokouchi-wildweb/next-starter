// eslint-rules/config-overrides.mjs
//
// 上書きファイル(src/config/{lib,domains,layout}/<名前>.config.ts と <名前>.ui.config.ts、中身の名前で置く上書き src/config/featureGate/<中身>.config.ts)の
// 2 つの規則(設定 D34・D35・D38・D91・L1.19・L1.31)。
// 全 Tier error(新しいフォルダだけが対象なので縮む表は無い)。置き方の決まり: src/config/README.md
//
// - literal-only(上書きファイルに掛ける): 値はリテラル、または env を読むだけの関数(下)。読んでよいのは
//     型だけの import、process.env、@/business の値、@/lib/appEnv の段階の判定の引数なしの呼び出し(isProduction() など、設定 D87)、
//     持ち主が自分の config.ts(描画用の上書きは config.ui.ts)で `export const overrideImports = [...] as const` と宣言した指定子(前方一致)の値。
//   ファイルの文は import・export default・型の宣言(export type Extra など)だけ。関数・呼び出し・new・変数・export const は書けない。
//   値の中で許す式: object / array(spread・計算されたキー・メソッド無し)・文字列 / 数 / 真偽 / null / undefined・式の無い template・
//   単項の - + !・as const・satisfies・process.env.<名前>・許した import の名前とその . の先・比較(=== !== == !=)と ?? || &&・条件式(env で切り替える)。
//   env を読むだけの関数: 引数なしの矢印関数で、本体が式の process.env.<名前>、またはそれを ?? / || でつないだ形(右端だけリテラルの既定可)。
//   例 `serviceAccountKey: () => process.env.MY_SERVICE_ACCOUNT_KEY`(呼んだ時に読む値。lib は server の中でだけ呼ぶ、設定 D249)
//   持ち主が `export const overrideLoaders = [...] as const` と宣言した指定子(書体の next/font など)から読んだ名前だけ、
//   トップレベルの `const <名前> = <ローダー>(<リテラルの引数>)` で呼べ、その名前は値として読める。
//   宣言は持ち主のファイルにだけ効く(上書きの中に overrideImports・overrideLoaders を書いても広がらない)。
// - owner-reads-only(src と scripts の全ファイルに掛ける): 上書きを読めるのは持ち主の config.ts(<名前>.ui.config.ts は config.ui.ts)だけ。
//   @/config/… ・相対・"src/…"・@lib-config/<名前> のどれで読んでも解いた実パスで判定し、型だけの import も止める。
//   lib の中から自分の上書きを読む所は lint entry/only-entries の持ち分なので見ない(二重に落とさない)。
//
// - config-imports(ドメインの config.ts に掛ける、地区の議会 D28・注文 38): 読み込めるのは @/lib/defineConfig・自分の上書き
//   (src/config/domains/<名前>.config、持ち主 = このファイル)・zod(値の検査)と、型だけの import。規則の when が config.ts の最上位の真偽を
//   指す(D28)ので、config.ts は値の外(services・drizzle・ほかのドメイン)を読まない
//
// 上書き → 持ち主は地区の地図(src/lib/districtMap)で引く(リポジトリごとに 1 回読んで覚える。地区を足したら eslint を起動し直す)。
// 中身の名前で置く上書きの持ち主は固定のフォルダ(種類の表 KINDS の override.shape "contents" の地区の dir、CONTENTS_OVERRIDE_FOLDERS、例 src/featureGate)で、読めるのはその中のファイル。宣言(overrideImports)は持たない。
// 持ち主の宣言の本文は毎回読む。

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { CONTENTS_OVERRIDE_FOLDERS, OVERRIDE_FOLDERS, OVERRIDE_ROOT, readOverrideImports, readOverrideLoaders } from "../src/lib/districtMap/index.mjs";
import { readDistrictMapAt } from "../src/lib/districtMap/node.mjs";
import { moduleVisitors, repoRelative, resolveImport } from "./resolve-import.mjs";

const FOLDERS = [...Object.values(OVERRIDE_FOLDERS), ...Object.keys(CONTENTS_OVERRIDE_FOLDERS)];
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
    if (d.override.path) slots.set(d.override.path, { district: d, ui: false, owner: d.config.path });
    if (d.uiOverride.path) slots.set(d.uiOverride.path, { district: d, ui: true, owner: d.uiConfig.path });
  }
  mapCache.set(root, slots);
  return slots;
}

/** 中身の名前で置く上書き(src/config/<フォルダ>/<中身の名前>.config.ts)なら { ownerDir }(持ち主のフォルダが無ければ ownerDir: null = noOwner)。そうでなければ null */
function baseSlot(root, overridePath) {
  const match = new RegExp(`^${OVERRIDE_ROOT}/([^/]+)/[^/]+\\.config\\.ts$`).exec(overridePath);
  const ownerDir = match ? CONTENTS_OVERRIDE_FOLDERS[match[1]] : undefined;
  if (!ownerDir) return null;
  return existsSync(path.join(root, ownerDir)) ? { ownerDir } : { ownerDir: null };
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

/** 持ち主の宣言(overrideLoaders)。持ち主のファイルが無ければ [] */
function declaredLoaders(root, ownerPath) {
  const abs = path.join(root, ownerPath);
  if (!existsSync(abs)) return [];
  return readOverrideLoaders(ownerPath, readFileSync(abs, "utf8")).loaders;
}

const TS_WRAPPERS = new Set(["TSAsExpression", "TSSatisfiesExpression", "TSNonNullExpression", "TSTypeAssertion"]);
const COMPARE = new Set(["===", "!==", "==", "!="]);

/** process.env(の読み) */
function isProcessEnv(node) {
  return node.type === "MemberExpression" && !node.computed && node.property.name === "env" && node.object.type === "Identifier" && node.object.name === "process";
}

/** 関数の中に置けるリテラル(既定の値): 文字列・数・真偽・null・式の無い template・undefined */
const isPlainLiteral = (node) =>
  (node.type === "Literal" && !node.regex) ||
  (node.type === "TemplateLiteral" && node.expressions.length === 0) ||
  (node.type === "Identifier" && node.name === "undefined");

/** process.env.X(X は名前か文字列) */
const isEnvRead = (node) =>
  node.type === "MemberExpression" &&
  isProcessEnv(node.object) &&
  (!node.computed || (node.property.type === "Literal" && typeof node.property.value === "string"));

/** process.env.X、またはそれを ?? / || でつないだ式(右端だけリテラルの既定可) */
function isEnvChain(node) {
  if (isEnvRead(node)) return true;
  if (node.type !== "LogicalExpression" || !["??", "||"].includes(node.operator)) return false;
  return isEnvChain(node.left) && (isEnvChain(node.right) || isPlainLiteral(node.right));
}

/** env を読むだけの関数: () => <isEnvChain>(引数なし・async でない・本体が式) */
const isEnvReader = (node) =>
  node.type === "ArrowFunctionExpression" && node.params.length === 0 && !node.async && node.expression && isEnvChain(node.body);

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
    case "ArrowFunctionExpression":
      return isEnvReader(node) ? null : node;
    default:
      return node;
  }
}

/** const <名前> = <宣言したローダー>(...) の 1 文か */
const isLoaderCall = (statement, loaderNames) =>
  statement.type === "VariableDeclaration" &&
  statement.kind === "const" &&
  statement.declarations.length === 1 &&
  statement.declarations[0].id.type === "Identifier" &&
  statement.declarations[0].init?.type === "CallExpression" &&
  statement.declarations[0].init.callee.type === "Identifier" &&
  loaderNames.has(statement.declarations[0].init.callee.name) &&
  !statement.declarations[0].init.arguments.some((arg) => arg.type === "SpreadElement");

const isTypeDeclaration = (node) => node && ["TSTypeAliasDeclaration", "TSInterfaceDeclaration"].includes(node.type);

const literalOnly = {
  meta: {
    type: "problem",
    docs: { description: "上書きファイルは値のリテラルか env を読むだけの関数(読めるのは process.env・@/business・持ち主が宣言した指定子、src/config/README.md)" },
    schema: [{ type: "object", properties: { root: { type: "string" } }, additionalProperties: false }],
    messages: {
      noOwner: "{{file}}: 持ち主の地区が無い上書き。pnpm check config-overrides で直し方を見る(src/config/README.md)",
      valueImport:
        '"{{source}}": 上書きで値として読めるのは @/business と、持ち主 {{owner}} が overrideImports で宣言した指定子だけです。型は import type で読みます(src/config/README.md)',
      sideEffect: '"{{source}}": 上書きに副作用の import は書けません',
      stageImport: "@/lib/appEnv から上書きで読めるのは段階の判定 {{names}} だけです(引数なしで呼ぶ、設定 D87)",
      statement: "上書きのファイルに書けるのは import・export default・型の宣言(export type Extra など)だけです。値は export default の中にリテラルで書きます",
      nonLiteral: "上書きの値はリテラルか env を読むだけの関数(() => process.env.X、?? / || でつなげる)です(他の関数・呼び出し・new・変数・式の template は書けない。読めるのは process.env・@/business・段階の判定 isProduction() など・宣言した import)",
      noDefault: "上書きは export default で値を 1 つ出します(空なら export default {} satisfies <持ち主の上書きの型>)",
    },
  },
  create(context) {
    const root = rootOf(context);
    const file = repoRelative(context.filename, root);
    if (!OVERRIDE_PATH.test(file)) return {};
    const base = baseSlot(root, file);
    const slot = base ? (base.ownerDir ? { owner: base.ownerDir, base: true } : undefined) : overrideSlots(root).get(file);
    return {
      Program(program) {
        if (!slot) {
          context.report({ node: program, messageId: "noOwner", data: { file } });
          return;
        }
        const declared = slot.base ? [] : declaredImports(root, slot.owner);
        const loaderSpecs = slot.base ? [] : declaredLoaders(root, slot.owner);
        const loaderNames = new Set();
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
            if (matchesPrefix(source, loaderSpecs)) {
              for (const s of statement.specifiers) if (!(s.type === "ImportSpecifier" && s.importKind === "type")) loaderNames.add(s.local.name);
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
          // 持ち主が overrideLoaders で宣言したローダーの呼び出し: const <名前> = <ローダー>(<リテラルの引数>)、その名前は値として読める
          if (loaderNames.size > 0 && isLoaderCall(statement, loaderNames)) {
            const args = statement.declarations[0].init.arguments;
            const bad = args.map((arg) => firstNonLiteral(arg, allowedNames, stageNames)).find(Boolean);
            if (bad) context.report({ node: bad, messageId: "nonLiteral" });
            allowedNames.add(statement.declarations[0].id.name);
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
      const base = baseSlot(root, override);
      if (base) {
        if (!base.ownerDir) context.report({ node, messageId: "noOwner", data: { source, override } });
        else if (!file.startsWith(`${base.ownerDir}/`)) context.report({ node, messageId: "notOwner", data: { source, override, owner: `${base.ownerDir}/ の中のファイル` } });
        return;
      }
      const slot = overrideSlots(root).get(override);
      if (!slot) {
        context.report({ node, messageId: "noOwner", data: { source, override } });
        return;
      }
      if (stripExt(file) === stripExt(slot.owner)) return;
      // lib の中から自分の上書きを読む所は lint entry/only-entries(@lib-config/<自分> だけ)の持ち分
      if (slot.district.kind === "lib" && file.startsWith(`${slot.district.dir}/`)) return;
      context.report({ node, messageId: "notOwner", data: { source, override, owner: slot.owner } });
    });
  },
};

/** ドメインの config.ts が値で読んでよい指定子(自分の上書きは持ち主の判定で別に通す) */
const CONFIG_VALUE_IMPORTS = ["@/lib/defineConfig", "zod"];

const configImports = {
  meta: {
    type: "problem",
    docs: { description: "ドメインの config.ts が読み込めるのは @/lib/defineConfig・自分の上書き・zod と型だけ(D28)" },
    schema: [{ type: "object", properties: { root: { type: "string" } }, additionalProperties: false }],
    messages: {
      configImport:
        '"{{source}}": ドメインの config.ts が値で読めるのは @/lib/defineConfig・自分の上書き・zod だけ(型は import type で可、D28)。値の中身はドメインのほかのファイルに置き、config.ts は値だけにする',
    },
  },
  create(context) {
    const root = rootOf(context);
    const file = repoRelative(context.filename, root);
    if (!/^src\/domains\/(?:.+\/)?config\.ts$/.test(file)) return {};
    return moduleVisitors(({ node, source, typeOnly }) => {
      if (typeOnly || CONFIG_VALUE_IMPORTS.includes(source)) return;
      const override = asOverridePath(resolveImport(source, context.filename, root));
      const slot = override ? overrideSlots(root).get(override) : null;
      if (slot && stripExt(file) === stripExt(slot.owner)) return;
      context.report({ node, messageId: "configImport", data: { source } });
    });
  },
};

const plugin = {
  meta: { name: "eslint-plugin-local-config-overrides", version: "1.0.0" },
  rules: { "literal-only": literalOnly, "owner-reads-only": ownerReadsOnly, "config-imports": configImports },
};

export default plugin;
