#!/usr/bin/env node
// .notices/20261116-134913-spacing-scale.spacing-scale.mjs
// 余白の区切り spacing-scale(余白の議会 N3)の fork の移行。Layout 部品(Block・InBlock・Section・Main・Flex・Grid・Stack)の余白 prop を、
// 見た目の大きさ(px)を保ったまま新しい余白の段へ写す。
// 新しい段 = none 0 / 2xs 4 / xs 8 / sm 12 / md 16 / lg 24 / xl 32 / 2xl 40 / 3xl 48 / 4xl 64px(全部品・全余白 prop で同じ名前 = 同じ大きさ)。
// - 旧表は書き換え前の版(--base)の src/components/Layout の 4 ファイル(commonVariants.ts・Grid.tsx・Flex.tsx・Stack.tsx)から読む(手書きしない)
// - 幅で大きさが変わる値は { base, sm } に、段に乗らない値は className に落とす。Stack の space は gap に名前を変える
// - JSX の字面に加え、同じファイルの const(オブジェクトの中も)・三項・?? の枝まで追う
// - Grid の columnGap・rowGap は gapX・gapY に名前を変える(Stack の space → gap と同じく、葉が全部写せたときだけ)
// - 上流の中継部品の prop(AppForm fieldSpace・ConfiguredFields space・UserTagList space = Stack の space、
//   UserPage padding = Main の padding)も中の部品の旧表で写す。prop 名は変えない。段に乗らない値は一覧
// - 新旧で名前が重なる(sm・md など)ため、書き換え済みかは名前で見分けず、書き換え前の版(--base)の同じ箇所の値と照らす。
//   だから --apply は --base <書き換え前のコミット> を必ず要する(無い・--no-base なら何も書かずに止まる)。同じ --base なら何度走らせても同じ結果
//
// 使い方(リポのルートで):
//   node .notices/20261116-134913-spacing-scale.spacing-scale.mjs                              dry-run(既定、書かない。件数と一覧を出す。--base 既定 HEAD)
//   node .notices/20261116-134913-spacing-scale.spacing-scale.mjs --apply --base <ref>         書く
//   --base <git ref>   書き換え前の版。fork = この区切りを取り込む前の自分のコミット
//   --no-base          照らさない(すべて旧の値として写す。dry-run だけ)
//   --root <dir>       別のリポを読む(既定 = 今のディレクトリ)
//   --json <file>      件数・変更・一覧を JSON で書き出す
//
// 止める物(書き換えず file:line + 理由の一覧に出す): 中継 wrapper の prop・別ファイルの定数・spread・その他の式。
// 既定値で付く所(prop を書かずに余白が付く Main など)は別の一覧に出す(部品の既定値の側で見た目を保つので直さなくてよい)。
//
// 手順(fork): 取り込む前のコミットを控える → 上流を取り込む → dry-run --base <控えたコミット> → --apply --base <同じコミット> →
// 一覧の所を手で直す → pnpm typecheck → 取り込みのコミット。この区切りのほかの codemod は無い

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, posix, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import ts from "typescript";

/** 新しい余白の段(名前 → px) */
export const STEPS = [
  ["none", 0],
  ["2xs", 4],
  ["xs", 8],
  ["sm", 12],
  ["md", 16],
  ["lg", 24],
  ["xl", 32],
  ["2xl", 40],
  ["3xl", 48],
  ["4xl", 64],
];
const STEP_PX = new Map(STEPS);
const STEP_BY_PX = new Map(STEPS.map(([name, px]) => [px, name]));

const LAYOUT_DIR = "src/components/Layout";
const COMMON = ["padding", "paddingBlock", "paddingInline", "margin", "marginBlock", "marginInline"];
/** 部品 → 余白 prop */
export const COMPONENT_PROPS = {
  Block: COMMON,
  InBlock: COMMON,
  Section: COMMON,
  Main: COMMON,
  Flex: [...COMMON, "gap"],
  Grid: [...COMMON, "gap", "columnGap", "rowGap"],
  Stack: [...COMMON, "space"],
};
/** prop の改名(旧 → 新)。葉が全部写せたときだけ名前を変える。新しい名前は新しい API にしかない = 書き換え済み */
export const RENAMES = {
  Stack: { space: "gap" },
  Grid: { columnGap: "gapX", rowGap: "gapY" },
};
/**
 * 上流の中継部品: 自分の prop を中の Layout 部品の余白 prop へそのまま渡す部品(L2.3)。
 * prop 名は変えず、値だけを中の部品の旧表で写す。段に乗らない値は className に落とせない(中の部品に届かない)ので一覧
 */
export const RELAYS = {
  AppForm: { modules: ["src/components/Form/AppForm", "src/components/Form"], props: { fieldSpace: ["Stack", "space"] } },
  ConfiguredFields: {
    modules: [
      "src/components/Form/Field/Configured/ConfiguredFields",
      "src/components/Form/Field/Configured",
      "src/components/Form/Field",
    ],
    props: { space: ["Stack", "space"] },
  },
  UserTagList: { modules: ["src/features/core/userTag/components/common/UserTagList"], props: { space: ["Stack", "space"] } },
  UserPage: { modules: ["src/app/(user)/_layout/UserPage"], props: { padding: ["Main", "padding"] } },
};
/** 部品(Layout と中継)→ 写す prop */
const propsOf = (component) => COMPONENT_PROPS[component] ?? (RELAYS[component] ? Object.keys(RELAYS[component].props) : undefined);
const isPart = (name) => Boolean(propsOf(name));

/** 旧表を読むファイル */
export const TABLE_FILES = {
  common: `${LAYOUT_DIR}/commonVariants.ts`,
  Grid: `${LAYOUT_DIR}/Grid.tsx`,
  Flex: `${LAYOUT_DIR}/Flex.tsx`,
  Stack: `${LAYOUT_DIR}/Stack.tsx`,
};
/** 既定値を読むファイル(部品の関数の引数の分割代入の初期値) */
const COMPONENT_FILES = Object.fromEntries(Object.keys(COMPONENT_PROPS).map((name) => [name, `${LAYOUT_DIR}/${name}.tsx`]));
/** shorthand が className に落ちたとき、残った軸の prop に勝ってしまう組 */
const AXIS_OF = { padding: ["paddingBlock", "paddingInline"], margin: ["marginBlock", "marginInline"] };

const toPosix = (path) => path.split(sep).join("/");

// ---------------------------------------------------------------- AST の小道具

function parse(fileName, text) {
  return ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function unwrap(node) {
  while (
    node &&
    (ts.isAsExpression(node) ||
      ts.isSatisfiesExpression(node) ||
      ts.isParenthesizedExpression(node) ||
      ts.isNonNullExpression(node) ||
      ts.isTypeAssertionExpression(node))
  ) {
    node = node.expression;
  }
  return node;
}

function keyText(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return name.text;
  return undefined;
}

function isStringNode(node) {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node);
}

function each(node, visit) {
  visit(node);
  node.forEachChild((child) => each(child, visit));
}

function findConstInitializer(sf, name) {
  let found;
  each(sf, (node) => {
    if (!found && ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) {
      found = unwrap(node.initializer);
    }
  });
  return found;
}

function objectProperty(object, key) {
  if (!object || !ts.isObjectLiteralExpression(object)) return undefined;
  for (const property of object.properties) {
    if (ts.isPropertyAssignment(property) && keyText(property.name) === key) return unwrap(property.initializer);
  }
  return undefined;
}

function stringRecord(object, where) {
  if (!object || !ts.isObjectLiteralExpression(object)) throw new Error(`旧表が読めない: ${where}`);
  const record = {};
  for (const property of object.properties) {
    if (!ts.isPropertyAssignment(property)) continue;
    const value = unwrap(property.initializer);
    const key = keyText(property.name);
    if (key !== undefined && isStringNode(value)) record[key] = value.text;
  }
  return record;
}

// ---------------------------------------------------------------- 旧表 → 新しい段

/**
 * 書き換え前の Layout のファイルから旧表と既定値を読む
 * @param {(rel: string) => string} readFile リポのルートからの相対パス → 中身
 */
export function loadOldTables(readFile) {
  const common = parse(TABLE_FILES.common, readFile(TABLE_FILES.common));
  const grid = parse(TABLE_FILES.Grid, readFile(TABLE_FILES.Grid));
  const flex = parse(TABLE_FILES.Flex, readFile(TABLE_FILES.Flex));
  const stack = parse(TABLE_FILES.Stack, readFile(TABLE_FILES.Stack));
  const tables = { common: {}, Grid: {}, Flex: {}, Stack: {} };
  for (const prop of COMMON) {
    tables.common[prop] = stringRecord(findConstInitializer(common, prop), `${TABLE_FILES.common} ${prop}`);
  }
  const gridDefinitions = findConstInitializer(grid, "gridVariantDefinitions");
  for (const prop of ["gap", "columnGap", "rowGap"]) {
    tables.Grid[prop] = stringRecord(objectProperty(gridDefinitions, prop), `${TABLE_FILES.Grid} ${prop}`);
  }
  tables.Flex.gap = stringRecord(
    objectProperty(findConstInitializer(flex, "flexVariantDefinitions"), "gap"),
    `${TABLE_FILES.Flex} gap`,
  );
  const scale = findConstInitializer(stack, "SPACING_SCALE");
  if (!scale || !ts.isArrayLiteralExpression(scale)) throw new Error(`旧表が読めない: ${TABLE_FILES.Stack} SPACING_SCALE`);
  // Stack の getGapClass は `gap-${space}` をそのまま返す
  tables.Stack.space = Object.fromEntries(
    scale.elements.filter((element) => ts.isNumericLiteral(element)).map((element) => [element.text, `gap-${element.text}`]),
  );
  return tables;
}

/** 部品の引数の分割代入の初期値(Main の padding = "md" など) */
export function loadDefaults(readFile) {
  const defaults = {};
  for (const [component, file] of Object.entries(COMPONENT_FILES)) {
    defaults[component] = {};
    let text;
    try {
      text = readFile(file);
    } catch {
      continue;
    }
    each(parse(file, text), (node) => {
      if (!ts.isFunctionDeclaration(node) || node.name?.text !== component) return;
      const pattern = node.parameters[0]?.name;
      if (!pattern || !ts.isObjectBindingPattern(pattern)) return;
      for (const element of pattern.elements) {
        const prop = keyText(element.propertyName ?? element.name);
        const value = element.initializer && unwrap(element.initializer);
        if (!prop || !value) continue;
        if (isStringNode(value)) defaults[component][prop] = value.text;
        else if (ts.isNumericLiteral(value)) defaults[component][prop] = value.text;
      }
    });
  }
  return defaults;
}

const CLASS_TOKEN = /^(?:(sm):)?(gap-x|gap-y|gap|px|py|p|mx|my|m)-(\d+(?:\.\d+)?)$/;

/** 余白の class 文字列 → px(幅別)。読めない class が混じれば ok:false */
export function classesToPx(classes) {
  const tokens = classes.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { empty: true, ok: true };
  let base;
  let sm;
  let family;
  for (const token of tokens) {
    const match = CLASS_TOKEN.exec(token);
    if (!match || (family && family !== match[2])) return { ok: false };
    family = match[2];
    const px = Number(match[3]) * 4;
    if (match[1] === "sm") sm = px;
    else base = px;
  }
  if (base === undefined) return { ok: false };
  return { ok: true, family, base, sm: sm ?? base };
}

/** 新しい値 → px(幅別)。className は class から読む */
export function resultToPx(result) {
  if (result.kind === "remove") return { empty: true, ok: true };
  if (result.kind === "class") return classesToPx(result.classes);
  if (result.kind === "step") return { ok: true, base: STEP_PX.get(result.value), sm: STEP_PX.get(result.value) };
  return { ok: true, base: STEP_PX.get(result.base), sm: STEP_PX.get(result.sm) };
}

/** 旧表の 1 値(class 文字列)→ 新しい値 */
export function mapClasses(classes) {
  const px = classesToPx(classes);
  if (px.empty) return { kind: "remove" };
  if (!px.ok) return { kind: "class", classes };
  const base = STEP_BY_PX.get(px.base);
  const sm = STEP_BY_PX.get(px.sm);
  if (px.base === px.sm && base) return { kind: "step", value: base };
  if (px.base !== px.sm && base && sm) return { kind: "resp", base, sm };
  return { kind: "class", classes };
}

/** 部品 → prop → 旧の値 → 新しい値 */
export function buildMapping(tables) {
  const mapping = {};
  for (const [component, props] of Object.entries(COMPONENT_PROPS)) {
    mapping[component] = {};
    for (const prop of props) {
      const table = COMMON.includes(prop) ? tables.common[prop] : tables[component][prop];
      mapping[component][prop] = Object.fromEntries(Object.entries(table).map(([key, classes]) => [key, mapClasses(classes)]));
    }
  }
  for (const [relay, { props }] of Object.entries(RELAYS)) {
    mapping[relay] = Object.fromEntries(Object.entries(props).map(([prop, [component, target]]) => [prop, mapping[component][target]]));
  }
  return mapping;
}

/** 旧表・既定値・対応表をまとめて読む */
export function loadSpacingTables(readFile) {
  const tables = loadOldTables(readFile);
  return { tables, mapping: buildMapping(tables), defaults: loadDefaults(readFile) };
}

// ---------------------------------------------------------------- 1 ファイルの解析

function createChecked(fileName, text) {
  const sf = parse(fileName, text);
  const host = {
    getSourceFile: (name) => (name === fileName ? sf : undefined),
    writeFile() {},
    getDefaultLibFileName: () => "/lib.d.ts",
    useCaseSensitiveFileNames: () => true,
    getCanonicalFileName: (name) => name,
    getCurrentDirectory: () => "/",
    getNewLine: () => "\n",
    fileExists: (name) => name === fileName,
    readFile: () => undefined,
  };
  const program = ts.createProgram([fileName], { noLib: true, noResolve: true, jsx: ts.JsxEmit.Preserve, types: [] }, host);
  return { sf, checker: program.getTypeChecker() };
}

/** import 元がどの部品か(@/components/Layout・@/components/Layout/<X>・相対・TextBlocks の Main・中継部品の置き場) */
function layoutModule(specifier, fileRel) {
  let target = specifier;
  if (specifier.startsWith(".")) target = posix.normalize(posix.join(posix.dirname(fileRel), specifier));
  else if (specifier.startsWith("@/")) target = `src/${specifier.slice(2)}`;
  else return undefined;
  target = target.replace(/\/index$/, "");
  // core のドメインは core/ を省いて import できる(@/features/userTag/… → src/features/core/userTag/…)
  const coreTarget = target.replace(/^src\/features\/(?!core\/)/, "src/features/core/");
  const relays = Object.entries(RELAYS)
    .filter(([, relay]) => relay.modules.includes(target) || relay.modules.includes(coreTarget))
    .map(([name]) => name);
  if (relays.length > 0) return { only: relays };
  if (target === LAYOUT_DIR) return { all: true };
  if (target === "src/components/TextBlocks") return { only: ["Main"] };
  if (target.startsWith(`${LAYOUT_DIR}/`)) {
    const name = target.slice(LAYOUT_DIR.length + 1);
    if (COMPONENT_PROPS[name]) return { only: [name] };
  }
  return undefined;
}

function layoutImports(sf, fileRel) {
  const locals = new Map();
  const namespaces = new Map();
  for (const statement of sf.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const source = layoutModule(statement.moduleSpecifier.text, fileRel);
    const bindings = statement.importClause?.namedBindings;
    if (!source || !bindings || statement.importClause.isTypeOnly) continue;
    if (ts.isNamespaceImport(bindings)) {
      namespaces.set(bindings.name.text, source);
      continue;
    }
    for (const element of bindings.elements) {
      const imported = (element.propertyName ?? element.name).text;
      if (element.isTypeOnly || !isPart(imported)) continue;
      if (source.all ? COMPONENT_PROPS[imported] : source.only.includes(imported)) locals.set(element.name.text, imported);
    }
  }
  return { locals, namespaces };
}

function componentOf(tagName, imports) {
  if (ts.isIdentifier(tagName)) return imports.locals.get(tagName.text);
  if (ts.isPropertyAccessExpression(tagName) && ts.isIdentifier(tagName.expression)) {
    const source = imports.namespaces.get(tagName.expression.text);
    const name = tagName.name.text;
    if (source && isPart(name) && (source.all ? COMPONENT_PROPS[name] : source.only.includes(name))) return name;
  }
  return undefined;
}

function declarationOf(checker, identifier) {
  const symbol = checker.getSymbolAtLocation(identifier);
  return { symbol, declaration: symbol?.valueDeclaration ?? symbol?.declarations?.[0] };
}

function insideParameter(node) {
  for (let current = node; current; current = current.parent) {
    if (ts.isParameter(current)) return true;
    if (ts.isFunctionLike(current) || ts.isSourceFile(current)) return false;
  }
  return false;
}

function isExported(declaration) {
  const statement = declaration.parent?.parent;
  return Boolean(statement && ts.isVariableStatement(statement) && statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));
}

/** 識別子が何に結び付くかの「追えない理由」 */
function untraceableReason(declaration) {
  if (!declaration) return "式(解けない名前)";
  if (ts.isImportSpecifier(declaration) || ts.isImportClause(declaration) || ts.isNamespaceImport(declaration)) {
    return "別ファイルの定数";
  }
  if (ts.isParameter(declaration) || (ts.isBindingElement(declaration) && insideParameter(declaration))) {
    return "中継 wrapper の prop";
  }
  if (ts.isBindingElement(declaration)) return "式(分割代入)";
  if (ts.isVariableDeclaration(declaration) && !(declaration.parent.flags & ts.NodeFlags.Const)) return "式(let / var)";
  return "式";
}

/**
 * ファイルを読み、Layout 要素と余白 prop の「葉」(字面・定数・三項・?? の枝の先)を集める
 */
function analyze(source, fileRel) {
  const { sf, checker } = createChecked(`/${fileRel}`, source);
  const imports = layoutImports(sf, fileRel);
  const declarationIndex = new Map();
  each(sf, (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      const list = declarationIndex.get(node.name.text) ?? [];
      list.push(node);
      declarationIndex.set(node.name.text, list);
    }
  });
  const constKey = (declaration) => `${declaration.name.text}#${declarationIndex.get(declaration.name.text).indexOf(declaration)}`;

  /** 葉を集める。ctx = 今いる定数({ declaration, symbol, propPath, entry })か null */
  function leaves(expression, path, ctx, entry) {
    const node = unwrap(expression);
    if (!node) return [{ kind: "untraceable", node: expression, reason: "式" }];
    if (isStringNode(node)) return [{ kind: "literal", node, value: node.text, path, ctx }];
    if (ts.isNumericLiteral(node)) return [{ kind: "literal", node, value: node.text, numeric: true, path, ctx }];
    if ((ts.isIdentifier(node) && node.text === "undefined") || node.kind === ts.SyntaxKind.NullKeyword) {
      return [{ kind: "noop", node }];
    }
    if (ts.isConditionalExpression(node)) {
      return [...leaves(node.whenTrue, `${path}?T`, ctx, entry), ...leaves(node.whenFalse, `${path}?F`, ctx, entry)];
    }
    if (
      ts.isBinaryExpression(node) &&
      (node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || node.operatorToken.kind === ts.SyntaxKind.BarBarToken)
    ) {
      return [...leaves(node.left, `${path}??L`, ctx, entry), ...leaves(node.right, `${path}??R`, ctx, entry)];
    }
    if (ts.isObjectLiteralExpression(node)) {
      const value = {};
      for (const property of node.properties) {
        const key = ts.isPropertyAssignment(property) ? keyText(property.name) : undefined;
        const init = key !== undefined ? unwrap(property.initializer) : undefined;
        if (!init || !isStringNode(init)) return [{ kind: "untraceable", node, reason: "式(オブジェクト)" }];
        value[key] = init.text;
      }
      return [{ kind: "literal", node, value, object: true, path, ctx }];
    }
    if (ts.isIdentifier(node) || ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) {
      return reference(node, ctx ? entry : node);
    }
    return [{ kind: "untraceable", node, reason: "式" }];
  }

  /** 識別子 / X.a.b を同じファイルの const へ追う */
  function reference(node, entry) {
    const names = [];
    let root = node;
    while (ts.isPropertyAccessExpression(root) || ts.isElementAccessExpression(root)) {
      if (ts.isPropertyAccessExpression(root)) names.unshift(root.name.text);
      else if (isStringNode(unwrap(root.argumentExpression))) names.unshift(unwrap(root.argumentExpression).text);
      else return [{ kind: "untraceable", node, reason: "式" }];
      root = unwrap(root.expression);
    }
    if (!ts.isIdentifier(root)) return [{ kind: "untraceable", node, reason: "式" }];
    const { symbol, declaration } = declarationOf(checker, root);
    if (!declaration || !ts.isVariableDeclaration(declaration) || !(declaration.parent.flags & ts.NodeFlags.Const)) {
      return [{ kind: "untraceable", node, reason: untraceableReason(declaration) }];
    }
    if (!ts.isIdentifier(declaration.name) || !declaration.initializer) return [{ kind: "untraceable", node, reason: "式(分割代入)" }];
    let value = unwrap(declaration.initializer);
    for (const name of names) {
      value = objectProperty(value, name);
      if (!value) return [{ kind: "untraceable", node, reason: "式(定数の中が読めない)" }];
    }
    const ctx = { declaration, symbol, propPath: names, key: `const|${constKey(declaration)}|${names.join(".")}` };
    return leaves(value, "", ctx, entry);
  }

  const elements = [];
  const counters = new Map();
  each(sf, (node) => {
    if (!ts.isJsxOpeningElement(node) && !ts.isJsxSelfClosingElement(node)) return;
    const component = componentOf(node.tagName, imports);
    if (!component) return;
    const index = counters.get(component) ?? 0;
    counters.set(component, index + 1);
    const attrs = new Map();
    let spread = null;
    let className = null;
    for (const attribute of node.attributes.properties) {
      if (ts.isJsxSpreadAttribute(attribute)) {
        spread ??= attribute;
        continue;
      }
      const name = attribute.name.getText(sf);
      if (name === "className") className = attribute;
      else if (propsOf(component).includes(name)) attrs.set(name, attribute);
    }
    const element = { node, component, key: `${component}#${index}`, attrs, spread, className, props: [] };
    for (const [name, attribute] of attrs) {
      const init = attribute.initializer;
      let found;
      if (!init) found = [{ kind: "untraceable", node: attribute, reason: "式(値のない prop)" }];
      else if (ts.isStringLiteral(init)) found = [{ kind: "literal", node: init, value: init.text, path: "", ctx: null }];
      else if (ts.isJsxExpression(init) && init.expression) found = leaves(init.expression, "", null, null);
      else found = [{ kind: "untraceable", node: attribute, reason: "式" }];
      for (const leaf of found) {
        leaf.baseKey = leaf.ctx ? `${leaf.ctx.key}|${leaf.path}` : `${element.key}|${name}|${leaf.path}`;
        if (leaf.ctx) leaf.entry = leafEntry(init.expression, leaf);
      }
      element.props.push({ name, attribute, leaves: found });
    }
    elements.push(element);
  });

  /** 定数へ入る直前の式(JSX 側の参照)。三項の中の参照もありうるので葉の ctx から逆に探す */
  function leafEntry(expression, leaf) {
    let found = null;
    each(expression, (node) => {
      if (found || !(ts.isIdentifier(node) || ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node))) return;
      let root = node;
      while (ts.isPropertyAccessExpression(root) || ts.isElementAccessExpression(root)) root = unwrap(root.expression);
      if (ts.isIdentifier(root) && checker.getSymbolAtLocation(root) === leaf.ctx.symbol) found = node;
    });
    return found;
  }

  /** const の参照を全部(宣言の名前を除く)、それぞれの「たどったプロパティの道」と一緒に */
  function referencesOf(symbol, declaration) {
    const refs = [];
    each(sf, (node) => {
      if (!ts.isIdentifier(node) || node === declaration.name) return;
      if (node.parent && ts.isPropertyAccessExpression(node.parent) && node.parent.name === node) return;
      if (checker.getSymbolAtLocation(node) !== symbol) return;
      const path = [];
      let top = node;
      for (;;) {
        const parent = top.parent;
        if (parent && ts.isPropertyAccessExpression(parent) && parent.expression === top) {
          path.push(parent.name.text);
          top = parent;
        } else if (parent && ts.isElementAccessExpression(parent) && parent.expression === top && isStringNode(unwrap(parent.argumentExpression))) {
          path.push(unwrap(parent.argumentExpression).text);
          top = parent;
        } else if (parent && (ts.isParenthesizedExpression(parent) || ts.isNonNullExpression(parent) || ts.isAsExpression(parent))) {
          top = parent;
        } else break;
      }
      refs.push({ top, path });
    });
    return refs;
  }

  return { sf, elements, referencesOf };
}

/** 書き換え前の版の値: baseKey → 値 */
function baseValues(source, fileRel) {
  const values = new Map();
  for (const element of analyze(source, fileRel).elements) {
    for (const prop of element.props) {
      for (const leaf of prop.leaves) if (leaf.kind === "literal") values.set(leaf.baseKey, leaf.value);
    }
  }
  return values;
}

// ---------------------------------------------------------------- 書き換え

const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function resultEquals(value, result) {
  if (result.kind === "step") return value === result.value;
  if (result.kind === "resp") return typeof value === "object" && sameValue(value, { base: result.base, sm: result.sm });
  return false;
}

function resultText(result) {
  if (result.kind === "step") return `"${result.value}"`;
  if (result.kind === "resp") return `{ base: "${result.base}", sm: "${result.sm}" }`;
  if (result.kind === "remove") return "undefined";
  return result.classes;
}

const valueText = (value) => (typeof value === "object" ? JSON.stringify(value) : String(value));

/**
 * 1 ファイルの中身を写す
 * @param {string} source 今の中身
 * @param {{ fileRel?: string, mapping: object, defaults?: object, baseSource?: string }} options
 *   baseSource = 書き換え前の版の中身(無い = 今の値を旧の値とみなす)
 * @returns {{ text: string, changes: object[], untraceable: object[], defaults: object[], counts: object }}
 */
export function transformSource(source, { fileRel = "src/file.tsx", mapping, defaults = {}, baseSource }) {
  const { sf, elements, referencesOf } = analyze(source, fileRel);
  const base = baseSource !== undefined && baseSource !== source ? baseValues(baseSource, fileRel) : null;
  const where = (node) => {
    const { line, character } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    return { file: fileRel, line: line + 1, col: character + 1 };
  };
  const snippet = (node) => node.getText(sf).replace(/\s+/g, " ").slice(0, 80);
  const changes = [];
  const untraceable = [];
  const defaultEntries = [];
  const counts = { step: 0, resp: 0, remove: 0, className: 0, same: 0, already: 0, untraceable: 0, defaults: 0 };
  const list = (element, prop, node, reason) => untraceable.push({ ...where(node), component: element.component, prop, reason, text: snippet(node) });

  // 1. 葉ごとの写し先を決める(同じ字面のノード = 定数は、使う所すべてで同じ写し先でないと書かない)
  const uses = []; // { element, prop, leaf, result | null, reason | null, state }
  for (const element of elements) {
    if (element.spread) list(element, "*", element.spread, "spread(余白 prop が入りうる)");
    for (const [prop, value] of Object.entries(defaults[element.component] ?? {})) {
      if (element.attrs.has(prop) || element.spread || !propsOf(element.component).includes(prop)) continue;
      const result = mapping[element.component][prop]?.[value];
      const px = result && resultToPx(result);
      if (px && !px.empty && (px.base > 0 || px.sm > 0)) {
        defaultEntries.push({ ...where(element.node), component: element.component, prop, default: value, px: px.base === px.sm ? `${px.base}` : `${px.base}→${px.sm}` });
      }
    }
    for (const prop of element.props) {
      for (const leaf of prop.leaves) {
        if (leaf.kind === "noop") continue;
        const use = { element, prop, leaf, result: null, reason: null, state: null };
        uses.push(use);
        if (leaf.kind === "untraceable") {
          use.state = "listed";
          use.reason = leaf.reason;
          continue;
        }
        const table = mapping[element.component][prop.name];
        const value = leaf.value;
        if (leaf.object) {
          use.state = "already";
          continue;
        }
        if (Object.hasOwn(table, value)) {
          const before = base?.has(leaf.baseKey) ? base.get(leaf.baseKey) : value;
          const mapped = Object.hasOwn(table, before) ? table[before] : null;
          if (before === value) {
            use.result = table[value];
            use.state = "map";
          } else if (mapped && resultEquals(value, mapped)) {
            use.state = "already";
          } else {
            use.state = "listed";
            use.reason = `書き換え前の版と食い違う(前: ${valueText(before)})`;
          }
        } else if (!RENAMES[element.component]?.[prop.name] && typeof value === "string" && !leaf.numeric && STEP_PX.has(value)) {
          use.state = "already"; // 新しい段にしかない名前(2xs・2xl・3xl・4xl)、中継の prop の段の名前
        } else {
          use.state = "listed";
          use.reason = `旧表にない値(${valueText(value)})`;
        }
      }
    }
  }

  const groupOf = (use) => use.leaf.node;
  const settle = () => {
    const groups = new Map();
    for (const use of uses) {
      if (use.state !== "map") continue;
      const list = groups.get(groupOf(use)) ?? [];
      list.push(use);
      groups.set(groupOf(use), list);
    }
    let changed = false;
    const fail = (group, reason) => {
      for (const use of group) {
        use.state = "listed";
        use.reason = reason;
      }
      changed = true;
    };
    for (const group of groups.values()) {
      const [first] = group;
      const { leaf } = first;
      // 同じ字面を写すすべての所が同じ写し先か
      if (group.some((use) => !sameValue(use.result, first.result))) {
        fail(group, "定数の値が部品・prop で写し先が違う");
        continue;
      }
      if (leaf.ctx) {
        if (first.result.kind === "class") {
          fail(group, `定数の値が段に乗らない(${first.result.classes})`);
          continue;
        }
        if (isExported(leaf.ctx.declaration)) {
          fail(group, "export された定数(別ファイルからも読まれうる)");
          continue;
        }
        if (leaf.ctx.declaration.type) {
          fail(group, "型注釈つきの定数");
          continue;
        }
        const entries = new Set(group.map((use) => use.leaf.entry));
        const target = leaf.ctx.propPath;
        const blocked = referencesOf(leaf.ctx.symbol, leaf.ctx.declaration).some((ref) => {
          const prefix = ref.path.length <= target.length && ref.path.every((name, i) => name === target[i]);
          return prefix && !(ref.path.length === target.length && entries.has(ref.top));
        });
        if (blocked) {
          fail(group, "定数がほかの所でも使われている");
          continue;
        }
      } else if (leaf.path !== "" && first.result.kind === "class") {
        fail(group, `三項・?? の枝が段に乗らない(${first.result.classes})`);
        continue;
      }
      if (RELAYS[first.element.component] && first.result.kind === "class") {
        fail(group, `中継の prop の値が段に乗らない(${first.result.classes}、className は中の部品に届かない)`);
        continue;
      }
      if (!leaf.ctx && leaf.path === "" && first.result.kind === "class") {
        const axes = AXIS_OF[first.prop.name] ?? [];
        if (axes.some((axis) => first.element.attrs.has(axis))) {
          fail(group, `${first.prop.name} が className に落ちると残る ${axes.join(" / ")} に勝ってしまう`);
          continue;
        }
      }
    }
    // 改名する prop(Stack の space → gap、Grid の columnGap → gapX 等)は、葉が全部写せるときだけ書く
    for (const element of elements) {
      const renames = RENAMES[element.component];
      if (!renames) continue;
      for (const prop of element.props) {
        const to = renames[prop.name];
        if (!to) continue;
        const mine = uses.filter((use) => use.prop === prop);
        const stuck = mine.find((use) => use.state === "listed");
        if (!stuck) continue;
        for (const use of mine) {
          if (use.state === "map") {
            use.state = "listed";
            use.reason = `${element.component} の ${prop.name} の別の枝が写せない(${to} へ名前を変えられない)`;
            changed = true;
          }
        }
      }
    }
    // className に落とす先が式なら書かない
    for (const element of elements) {
      const moving = uses.filter((use) => use.element === element && use.state === "map" && use.result.kind === "class");
      if (moving.length === 0 || !element.className) continue;
      const init = element.className.initializer;
      const expression = init && ts.isJsxExpression(init) ? unwrap(init.expression) : null;
      const ok = !init || ts.isStringLiteral(init) || (expression && (isStringNode(expression) || ts.isCallExpression(expression)));
      if (!ok) fail(moving, `className が式(${moving.map((use) => use.result.classes).join(" ")} を手で足す)`);
    }
    return changed;
  };
  while (settle());

  // 2. 書き換えを組み立てる
  const edits = [];
  const edited = new Set();
  const replace = (node, text) => edits.push({ start: node.getStart(sf), end: node.getEnd(), text });
  const classesFor = new Map();
  for (const use of uses) {
    const { element, prop, leaf } = use;
    const at = where(leaf.node);
    if (use.state === "listed") {
      const node = leaf.ctx ? prop.attribute : leaf.node;
      list(element, prop.name, node, leaf.ctx ? `${use.reason}(定数 ${leaf.ctx.declaration.name.text})` : use.reason);
      continue;
    }
    if (use.state === "already") {
      counts.already += 1;
      continue;
    }
    const result = use.result;
    const record = { ...at, component: element.component, prop: prop.name, from: leaf.value, kind: result.kind, to: resultText(result) };
    if (result.kind === "class") {
      edits.push({ start: prop.attribute.getFullStart(), end: prop.attribute.getEnd(), text: "" });
      classesFor.set(element, [...(classesFor.get(element) ?? []), result.classes]);
      counts.className += 1;
      changes.push(record);
      continue;
    }
    const direct = !leaf.ctx && leaf.path === "";
    if (result.kind === "step" && !leaf.numeric && leaf.value === result.value) {
      counts.same += 1;
      continue;
    }
    if (result.kind === "remove" && direct) {
      edits.push({ start: prop.attribute.getFullStart(), end: prop.attribute.getEnd(), text: "" });
    } else if (!edited.has(leaf.node)) {
      edited.add(leaf.node);
      // JSX の属性に直に書いた値は属性の値ごと(space={4} → gap="md"、padding="md" → padding={{ … }})
      if (direct) replace(prop.attribute.initializer, result.kind === "resp" ? `{${resultText(result)}}` : resultText(result));
      else replace(leaf.node, resultText(result));
    }
    counts[result.kind] += 1;
    changes.push(record);
  }
  // 改名(葉が全部写せた prop だけ。className に落ちた・直に外した prop は属性ごと消えている)
  for (const element of elements) {
    const renames = RENAMES[element.component];
    if (!renames) continue;
    for (const prop of element.props) {
      const to = renames[prop.name];
      if (!to) continue;
      const mine = uses.filter((use) => use.prop === prop);
      if (mine.length === 0 || mine.some((use) => use.state !== "map")) continue;
      const gone = mine.some(
        (use) => use.result.kind === "class" || (use.result.kind === "remove" && !use.leaf.ctx && use.leaf.path === ""),
      );
      if (!gone) replace(prop.attribute.name, to);
    }
  }
  for (const [element, classes] of classesFor) {
    const added = classes.join(" ");
    const init = element.className?.initializer;
    if (!element.className) {
      edits.push({ start: element.node.attributes.getEnd(), end: element.node.attributes.getEnd(), text: ` className="${added}"` });
    } else if (!init) {
      // 起こりえない(settle で弾く)
    } else if (ts.isStringLiteral(init)) {
      replace(init, `"${[added, init.text].filter(Boolean).join(" ")}"`);
    } else {
      const expression = unwrap(init.expression);
      if (isStringNode(expression)) replace(expression, `"${[added, expression.text].filter(Boolean).join(" ")}"`);
      else {
        // cn(...) などの呼び出し: 先頭へ(後ろの className が勝つ順は旧と同じ)
        const first = expression.arguments[0];
        const at = first ? first.getStart(sf) : expression.arguments.pos;
        edits.push({ start: at, end: at, text: first ? `"${added}", ` : `"${added}"` });
      }
    }
  }

  edits.sort((a, b) => b.start - a.start || b.end - a.end);
  let text = source;
  let floor = Infinity;
  for (const edit of edits) {
    if (edit.end > floor) throw new Error(`${fileRel}: 書き換えが重なった`);
    text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
    floor = edit.start;
  }
  const order = (a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.col - b.col || a.prop.localeCompare(b.prop);
  const seen = new Set();
  const listed = untraceable.sort(order).filter((entry) => {
    const id = JSON.stringify(entry);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  counts.untraceable = listed.length;
  counts.defaults = defaultEntries.length;
  return { text, changes: changes.sort(order), untraceable: listed, defaults: defaultEntries.sort(order), counts };
}

// ---------------------------------------------------------------- リポ全体

function walk(dir, found = []) {
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, found);
    else found.push(full);
  }
  return found;
}

function git(root, args) {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 64 * 1024 * 1024 });
}

/** 書き換え前の版の読み手: rel → 中身 | undefined(その版に無い・照らさない) */
function baseReader(root, ref) {
  if (!ref) return { ref: null, read: () => undefined };
  try {
    git(root, ["rev-parse", "--verify", `${ref}^{commit}`]);
  } catch {
    throw new Error(`--base ${ref} がコミットとして解けない(${root})`);
  }
  const changed = new Set(git(root, ["diff", "--name-only", "--relative", ref, "--", "src"]).split("\n").filter(Boolean));
  const untracked = new Set(git(root, ["ls-files", "--others", "--exclude-standard", "--", "src"]).split("\n").filter(Boolean));
  return {
    ref,
    read(rel, current) {
      if (untracked.has(rel)) return undefined;
      if (!changed.has(rel)) return current;
      try {
        return git(root, ["show", `${ref}:${rel}`]);
      } catch {
        return undefined;
      }
    },
  };
}

/**
 * リポの src を写す
 * @param {string} root
 * @param {{ base?: string | null, write?: boolean }} options base = 書き換え前の版の git ref(既定 HEAD、null = 照らさない)。write は base の文字列を要する
 */
export function run(root, { base, write = false } = {}) {
  if (write && typeof base !== "string") throw new Error("書き込みには base(書き換え前のコミット)が要る");
  const reader = baseReader(root, base === undefined ? "HEAD" : base);
  const readTable = (rel) => {
    const current = existsSync(join(root, rel)) ? readFileSync(join(root, rel), "utf8") : undefined;
    const before = reader.read(rel, current);
    if (before !== undefined) return before;
    if (current === undefined) throw new Error(`旧表のファイルが無い: ${rel}`);
    return current;
  };
  const { mapping, defaults } = loadSpacingTables(readTable);
  const report = {
    root,
    base: reader.ref,
    mode: write ? "apply" : "dry-run",
    counts: { step: 0, resp: 0, remove: 0, className: 0, same: 0, already: 0, untraceable: 0, defaults: 0, files: 0 },
    changes: [],
    untraceable: [],
    defaults: [],
    files: [],
  };
  const files = walk(join(root, "src"))
    .map((file) => toPosix(relative(root, file)))
    .filter((rel) => /\.(tsx|jsx)$/.test(rel) && !rel.startsWith(`${LAYOUT_DIR}/`))
    .sort();
  for (const rel of files) {
    const source = readFileSync(join(root, rel), "utf8");
    if (!/Layout|TextBlocks|AppForm|ConfiguredFields|UserTagList|UserPage|components\/Form/.test(source)) continue;
    const result = transformSource(source, { fileRel: rel, mapping, defaults, baseSource: reader.read(rel, source) });
    for (const [key, value] of Object.entries(result.counts)) report.counts[key] += value;
    report.changes.push(...result.changes);
    report.untraceable.push(...result.untraceable);
    report.defaults.push(...result.defaults);
    if (result.text !== source) {
      report.files.push(rel);
      report.counts.files += 1;
      if (write) writeFileSync(join(root, rel), result.text);
    }
  }
  return report;
}

export function formatReport(report) {
  const c = report.counts;
  const lines = [
    `spacing-scale: ${report.mode} | root: ${report.root} | base: ${report.base ?? "(照らさない)"}`,
    `写せた: ${c.step + c.resp + c.remove}(段の名前 ${c.step} / 幅別 ${c.resp} / prop を外す ${c.remove}) | className に落ちた: ${c.className} | 名前そのまま: ${c.same} | 書き換え済み: ${c.already} | 追えない: ${c.untraceable} | 既定値で付く所: ${c.defaults} | 変わるファイル: ${c.files}`,
  ];
  if (report.untraceable.length > 0) {
    lines.push("追えない所:");
    for (const e of report.untraceable) lines.push(`  ${e.file}:${e.line}:${e.col}  ${e.component} ${e.prop}  ${e.reason}  \`${e.text}\``);
  }
  if (report.defaults.length > 0) {
    lines.push("既定値で付く所(prop を書かずに余白が付く):");
    for (const e of report.defaults) lines.push(`  ${e.file}:${e.line}:${e.col}  ${e.component} ${e.prop}(既定 ${e.default} = ${e.px}px)`);
  }
  return lines.join("\n");
}

/**
 * 引数を読む。--apply は --base <ref> を必ず要する(D38)。--write は旧い名前なので止める
 * @param {string[]} args
 * @returns {{ root: string, base: string | null, write: boolean, json?: string } | { error: string }}
 */
export function parseArgs(args, cwd = process.cwd()) {
  const option = (name) => {
    const at = args.indexOf(name);
    return at >= 0 ? args[at + 1] : undefined;
  };
  if (args.includes("--write")) return { error: "--write は使えない。書くのは --apply --base <書き換え前のコミット>" };
  const write = args.includes("--apply");
  const baseOption = option("--base");
  if (args.includes("--base") && (!baseOption || baseOption.startsWith("--"))) return { error: "--base に git ref を渡す" };
  if (write && (args.includes("--no-base") || !baseOption)) {
    return { error: "--apply は --base <書き換え前のコミット> を要する(--no-base では書かない)。fork = この区切りを取り込む前の自分のコミット" };
  }
  const base = args.includes("--no-base") ? null : (baseOption ?? "HEAD");
  return { root: resolve(option("--root") ?? cwd), base, write, json: option("--json") };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const parsed = parseArgs(process.argv.slice(2));
  if ("error" in parsed) {
    console.error(`spacing-scale: ${parsed.error}`);
    process.exit(1);
  }
  const report = run(parsed.root, { base: parsed.base, write: parsed.write });
  if (parsed.json) writeFileSync(parsed.json, `${JSON.stringify(report, null, 2)}\n`);
  console.log(formatReport(report));
}
