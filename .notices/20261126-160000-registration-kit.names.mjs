// .notices/20261126-160000-registration-kit.names.mjs
// 名前の道具(区切り registration-kit、D336・D344): 登録ごとの汎用の一式のファイルに登録名を付ける。全ドメインで 1 つの形:
//   services/server/drizzleBase.ts・firestoreBase.ts → services/server/<登録名>Base.ts(export <登録名>Base。今の export base は名前も変える)
//   constants/field.ts → constants/<登録名>Field.ts | types/field.ts → types/<登録名>Field.ts | types/adminBulkAction.ts → types/<登録名>AdminBulkAction.ts
//   presenters.ts → <登録名>Presenters.ts | services/server/collections.ts → services/server/<登録名>Collections.ts
//   services/server/storagePurposes.ts → services/server/<登録名>StoragePurposes.ts
// - 土台の行き先の登録: export の名前が <登録名>Base ならその登録、他は createCrudService の第 1 引数 <Pascal>Table の登録、Firestore はドメインの主の登録
//   1 つのファイルに土台が複数(例 auditLog の auditLogBase と auditLogFailedBase)なら、登録ごとのファイルに分ける(文はどの土台が使うか・どの土台を使うかで付ける)
// - ほかの 6 種類の行き先: ドメインの主の登録(登録名 = ドメイン名、無ければ登録がちょうど 1 つの時のそれ)。主の無いドメイン(messaging など)・登録の無いドメイン
//   (admin・userProfile)の同じ名のファイルはドメイン全体の物なので触らない(計画に「そのまま」と出す)
// - 読み手の書き換え: src・scripts・tests・eslint-rules の import・export from・import()・mock.module() の道(@/ と相対)と、名前の変わる export(base → <登録名>Base)
//   の import の要素と、その名前を指す参照(型の検査器で束縛を確かめる。同じ名前の別の束縛は触らない)。entity.json の service.file も
//   生成物(頭に「生成物・編集不可」)は書き換えず、その生成器で作り直す(pnpm generate registry・pnpm generate domain)
// - 止める(何も書かない): 行き先が既にある、土台の登録を決められない、文をどの土台にも付けられない、書き換えられない読み手(名前の変わる export を
//   import * で読む・export from で外へ出す・import() の結果から読む、新しい名前が読み手に既にある)
//
// 使い方(リポのルートで、tsx の上): npx tsx --import ./scripts/runner/preload/serverOnly.mjs .notices/20261126-160000-registration-kit.names.mjs [--write]
//   既定 = 計画だけ(何も書かない)。--write = 移す・書き換える。続けて pnpm generate registry と pnpm generate domain(生成する登録のあるドメイン)。
//   何度走らせても同じ結果(移し済みのファイルは計画に出ない)

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import ts from "typescript";

import { nodeDomainSource, primaryRegistrationOf, readDomains } from "../src/lib/domain/node.mjs";

/** 6 種類の今の名前 → 新しい名前(登録名を前に付ける。ドメインのフォルダからの相対) */
export const KIT_FILES = [
  { from: "constants/field.ts", to: (reg) => `constants/${reg}Field.ts` },
  { from: "types/field.ts", to: (reg) => `types/${reg}Field.ts` },
  { from: "types/adminBulkAction.ts", to: (reg) => `types/${reg}AdminBulkAction.ts` },
  { from: "presenters.ts", to: (reg) => `${reg}Presenters.ts` },
  { from: "services/server/collections.ts", to: (reg) => `services/server/${reg}Collections.ts` },
  { from: "services/server/storagePurposes.ts", to: (reg) => `services/server/${reg}StoragePurposes.ts` },
];
/** 土台の今の名前 */
export const BASE_FILES = ["services/server/drizzleBase.ts", "services/server/firestoreBase.ts"];
/** 土台を作る関数 */
const BASE_FACTORIES = new Set(["createCrudService", "createFirestoreCrudService"]);
/** 読み手を探す場所 */
const READER_ROOTS = ["src", "scripts", "tests", "eslint-rules"];
const GENERATED_HEAD = /生成物・編集不可/;

const sourceOf = (text, name) => ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, name.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const lowerFirst = (value) => value.charAt(0).toLowerCase() + value.slice(1);
const stemOf = (rel) => rel.replace(/\.(ts|tsx|mts|mjs|js)$/, "");

/** 文が宣言する名前 */
function declaredNames(statement) {
  if (ts.isVariableStatement(statement)) return statement.declarationList.declarations.flatMap((d) => (ts.isIdentifier(d.name) ? [d.name.text] : []));
  if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement) || ts.isEnumDeclaration(statement)) && statement.name) return [statement.name.text];
  if (ts.isImportDeclaration(statement)) {
    const clause = statement.importClause;
    if (!clause) return [];
    const names = clause.name ? [clause.name.text] : [];
    const bindings = clause.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) names.push(...bindings.elements.map((e) => e.name.text));
    if (bindings && ts.isNamespaceImport(bindings)) names.push(bindings.name.text);
    return names;
  }
  return [];
}

/** 文の中で使う識別子 */
function usedNames(node, out = new Set()) {
  if (ts.isIdentifier(node)) out.add(node.text);
  ts.forEachChild(node, (child) => {
    usedNames(child, out);
  });
  return out;
}

/** 初期化式から土台を作る呼び出しを取り出す(as・括弧を外す) */
function factoryCallOf(expression) {
  let node = expression;
  while (node && (ts.isAsExpression(node) || ts.isParenthesizedExpression(node) || ts.isSatisfiesExpression?.(node))) node = node.expression;
  return node && ts.isCallExpression(node) && ts.isIdentifier(node.expression) && BASE_FACTORIES.has(node.expression.text) ? node : null;
}

/**
 * 1 つの土台のファイルの計画: 土台の export ごとの行き先の登録と、分けるときの文の付け先
 * @param {string} text
 * @param {string} rel
 * @param {{ name: string, registrations: { name: string }[] }} declaration
 * @returns {{ files: { registration: string, text: string, renames: Record<string, string>, names: string[] }[], stops: string[] }}
 */
export function planBaseFile(text, rel, declaration) {
  const source = sourceOf(text, rel);
  const stops = [];
  const registrationNames = new Set(declaration.registrations.map((registration) => registration.name));
  const primary = primaryRegistrationOf(declaration)?.name ?? null;
  const isFirestore = rel.endsWith("firestoreBase.ts");
  /** @type {{ statement: ts.Statement, exportName: string, registration: string }[]} */
  const bases = [];
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement) || !statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) continue;
    for (const declarationNode of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declarationNode.name) || !declarationNode.initializer) continue;
      const call = factoryCallOf(declarationNode.initializer);
      if (!call) continue;
      const exportName = declarationNode.name.text;
      let registration = null;
      const named = exportName.endsWith("Base") ? exportName.slice(0, -"Base".length) : null;
      if (named && registrationNames.has(named)) registration = named;
      else if (!isFirestore && call.arguments[0] && ts.isIdentifier(call.arguments[0]) && call.arguments[0].text.endsWith("Table")) {
        const candidate = lowerFirst(call.arguments[0].text.slice(0, -"Table".length));
        if (registrationNames.has(candidate)) registration = candidate;
      } else if (isFirestore) registration = primary;
      if (!registration) stops.push(`${rel}: 土台 ${exportName} の登録を決められない(export を <登録名>Base にするか、第 1 引数を <Pascal>Table に)`);
      else bases.push({ statement, exportName, registration });
    }
  }
  if (bases.length === 0) stops.push(`${rel}: 土台(createCrudService / createFirestoreCrudService の export)が無い`);
  if (new Set(bases.map((base) => base.registration)).size !== bases.length) stops.push(`${rel}: 同じ登録の土台が 2 つある`);
  if (stops.length > 0) return { files: [], stops };

  const renamesOf = (group) => Object.fromEntries(group.filter((base) => base.exportName !== `${base.registration}Base`).map((base) => [base.exportName, `${base.registration}Base`]));
  if (bases.length === 1) {
    const [only] = bases;
    const exported = source.statements.flatMap((statement) => (statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ? declaredNames(statement) : []));
    return { files: [{ registration: only.registration, text, renames: renamesOf(bases), names: exported }], stops };
  }

  // 分ける: 文ごとに、どの土台が(直に・間接に)使うか、どの土台の物を使うかで付ける
  const body = source.statements.filter((statement) => !ts.isImportDeclaration(statement));
  const owner = new Map(); // statement → registration
  const nameToStatement = new Map();
  for (const statement of body) for (const name of declaredNames(statement)) nameToStatement.set(name, statement);
  for (const base of bases) {
    const queue = [base.statement];
    while (queue.length > 0) {
      const statement = queue.pop();
      const current = owner.get(statement);
      if (current && current !== base.registration) {
        stops.push(`${rel}: ${declaredNames(statement).join(", ")} を 2 つの土台(${current}・${base.registration})が使う(共有の物は別のファイルへ手で移してから)`);
        continue;
      }
      if (current) continue;
      owner.set(statement, base.registration);
      for (const name of usedNames(statement)) {
        const next = nameToStatement.get(name);
        if (next && next !== statement) queue.push(next);
      }
    }
  }
  for (const statement of body) {
    if (owner.has(statement)) continue;
    const owners = new Set([...usedNames(statement)].map((name) => owner.get(nameToStatement.get(name))).filter(Boolean));
    if (owners.size === 1) owner.set(statement, [...owners][0]);
    else stops.push(`${rel}: ${declaredNames(statement).join(", ") || statement.getText(source).slice(0, 40)} をどの土台にも付けられない`);
  }
  if (stops.length > 0) return { files: [], stops };
  const imports = source.statements.filter((statement) => ts.isImportDeclaration(statement));
  const head = text.slice(0, source.statements[0]?.getFullStart() ?? 0).replace(/^\/\/ [^\n]*\n/, "");
  const files = [];
  for (const registration of [...new Set(bases.map((base) => base.registration))]) {
    const mine = body.filter((statement) => owner.get(statement) === registration);
    const used = new Set(mine.flatMap((statement) => [...usedNames(statement)]));
    const importLines = imports.flatMap((statement) => {
      const clause = statement.importClause;
      const bindings = clause?.namedBindings;
      if (!clause || !bindings || !ts.isNamedImports(bindings) || clause.name) return used.has(declaredNames(statement)[0]) ? [statement.getText(source)] : [];
      const keep = bindings.elements.filter((element) => used.has(element.name.text)).map((element) => element.getText(source));
      return keep.length > 0 ? [`import ${clause.isTypeOnly ? "type " : ""}{ ${keep.join(", ")} } from ${statement.moduleSpecifier.getText(source)};`] : [];
    });
    const bodyText = mine.map((statement) => text.slice(statement.getFullStart(), statement.getEnd()).replace(/^\n+/, "")).join("\n\n");
    files.push({
      registration,
      text: `// @@PATH@@\n${head.trimEnd() ? `${head.trimEnd()}\n` : ""}\n${importLines.join("\n")}\n\n${bodyText}\n`.replace(/\n{3,}/g, "\n\n"),
      renames: renamesOf(bases.filter((base) => base.registration === registration)),
      names: mine.filter((statement) => statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)).flatMap((statement) => declaredNames(statement)),
    });
  }
  return { files, stops };
}

/**
 * リポジトリの計画: 移すファイル・消すファイル・名前の変わる export・ドメイン全体の物として残すファイル
 * @param {string} repoRoot
 */
export function planMoves(repoRoot) {
  const plan = { writes: {}, removes: [], moves: new Map(), kept: [], stops: [], entityJson: {} };
  // moves: 今の道(拡張子なし) → { names: Map<今の名前, { stem, name }>, whole: 拡張子なしの新しい道 | null }
  for (const declaration of readDomains(nodeDomainSource(repoRoot))) {
    if (declaration.dir.startsWith("src/domains/_")) continue;
    const domainRel = declaration.dir;
    const has = (rel) => fs.existsSync(path.join(repoRoot, domainRel, rel));
    const primary = primaryRegistrationOf(declaration)?.name ?? null;
    for (const kit of KIT_FILES) {
      if (!has(kit.from)) continue;
      if (!primary) {
        plan.kept.push(`${domainRel}/${kit.from}(主の登録が無いドメインの、ドメイン全体の物)`);
        continue;
      }
      const target = `${domainRel}/${kit.to(primary)}`;
      if (fs.existsSync(path.join(repoRoot, target))) {
        plan.stops.push(`${target} が既にある(${domainRel}/${kit.from} と 1 つにまとめてから)`);
        continue;
      }
      const from = `${domainRel}/${kit.from}`;
      plan.writes[target] = withPath(fs.readFileSync(path.join(repoRoot, from), "utf8"), from, target);
      plan.removes.push(from);
      plan.moves.set(stemOf(from), { whole: stemOf(target), names: new Map() });
    }
    for (const baseFile of BASE_FILES) {
      if (!has(baseFile)) continue;
      const from = `${domainRel}/${baseFile}`;
      const { files, stops } = planBaseFile(fs.readFileSync(path.join(repoRoot, from), "utf8"), from, declaration);
      plan.stops.push(...stops);
      if (stops.length > 0) continue;
      const names = new Map();
      for (const file of files) {
        const target = `${domainRel}/services/server/${file.registration}Base.ts`;
        if (fs.existsSync(path.join(repoRoot, target))) {
          plan.stops.push(`${target} が既にある`);
          continue;
        }
        let text = file.text.includes("// @@PATH@@") ? file.text.replace("// @@PATH@@", `// ${target}`) : withPath(file.text, from, target);
        text = renameDeclarations(text, target, file.renames);
        plan.writes[target] = text;
        for (const name of file.names) names.set(name, { stem: stemOf(target), name: file.renames[name] ?? name });
      }
      plan.removes.push(from);
      plan.moves.set(stemOf(from), { whole: files.length === 1 ? stemOf(`${domainRel}/services/server/${files[0].registration}Base.ts`) : null, names });
    }
    // entity.json の service.file(services/server/ からの相対の道、拡張子なし)
    for (const registration of declaration.registrations) {
      const service = registration.entity?.service;
      if (!service || typeof service.file !== "string") continue;
      const move = plan.moves.get(`${domainRel}/services/server/${service.file}`);
      if (!move) continue;
      const target = move.names.get(service.export) ?? (move.whole ? { stem: move.whole, name: service.export } : null);
      if (!target) {
        plan.stops.push(`${registration.dir}/entity.json: service ${service.file}/${service.export} の行き先が分からない`);
        continue;
      }
      const entityPath = `${registration.dir}/entity.json`;
      const entity = JSON.parse(fs.readFileSync(path.join(repoRoot, entityPath), "utf8"));
      entity.service = { ...entity.service, file: path.posix.relative(`${domainRel}/services/server`, target.stem), export: target.name };
      plan.entityJson[entityPath] = `${JSON.stringify(entity, null, 2)}\n`;
    }
  }
  return plan;
}

/** 頭のコメントの自分の道(最初の // 行が今の道か、その末尾で終わる道。core/ の無い古い形も)を新しい道に */
function withPath(text, from, target) {
  const kit = from.split("/").slice(from.startsWith("src/domains/core/") ? 4 : 3).join("/"); // ドメインのフォルダからの相対
  const [first, ...rest] = text.split("\n");
  const match = /^\/\/ (\S+)$/.exec(first);
  if (match && (match[1] === from || match[1].endsWith(`/${kit}`))) return [`// ${target}`, ...rest].join("\n");
  return text;
}

/** ファイルの中の宣言と参照の名前を変える(土台の export base → <登録名>Base。同じファイルの中の参照も) */
function renameDeclarations(text, rel, renames) {
  if (Object.keys(renames).length === 0) return text;
  const source = sourceOf(text, rel);
  const edits = [];
  const visit = (node) => {
    if (ts.isIdentifier(node) && Object.hasOwn(renames, node.text)) {
      const parent = node.parent;
      const isPropertyName = (ts.isPropertyAccessExpression(parent) && parent.name === node) || (ts.isPropertyAssignment(parent) && parent.name === node);
      if (!isPropertyName) edits.push({ start: node.getStart(source), end: node.getEnd(), text: renames[node.text] });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  let next = text;
  for (const edit of edits.sort((a, b) => b.start - a.start)) next = `${next.slice(0, edit.start)}${edit.text}${next.slice(edit.end)}`;
  return next;
}

/** 読み手の道(指定子)を、リポジトリ相対の道(拡張子なし)に。@/domains/<core のドメイン> は core/ を省いた形も */
function resolveSpecifier(repoRoot, rel, specifier) {
  let target = null;
  if (specifier.startsWith("@/")) target = `src/${specifier.slice(2)}`;
  else if (specifier.startsWith(".")) target = path.posix.normalize(`${path.posix.dirname(rel)}/${specifier}`);
  if (!target) return null;
  target = stemOf(target);
  if (target.startsWith("src/domains/") && !target.startsWith("src/domains/core/")) {
    const domain = target.split("/")[2];
    if (!fs.existsSync(path.join(repoRoot, "src/domains", domain)) && fs.existsSync(path.join(repoRoot, "src/domains/core", domain))) target = target.replace("src/domains/", "src/domains/core/");
  }
  return target;
}

/** 新しい道(リポジトリ相対、拡張子なし)を、今の指定子の形(@/ か相対、core/ の有無、拡張子)で書く */
function specifierFor(rel, specifier, newStem) {
  const ext = /\.(ts|tsx|mjs|js)$/.exec(specifier)?.[0] ?? "";
  if (specifier.startsWith("@/")) {
    const omitsCore = specifier.startsWith("@/domains/") && !specifier.startsWith("@/domains/core/") && newStem.startsWith("src/domains/core/");
    return `@/${(omitsCore ? newStem.replace("src/domains/core/", "domains/") : newStem.slice("src/".length))}${ext}`;
  }
  const relative = path.posix.relative(path.posix.dirname(rel), newStem);
  return `${relative.startsWith(".") ? relative : `./${relative}`}${ext}`;
}

/**
 * 読み手の書き換えの計画
 * @param {string} repoRoot
 * @param {ReturnType<typeof planMoves>} plan
 * @param {Record<string, string>} [given] 道 → 本文(テスト用。省略 = git grep)
 * @returns {{ writes: Record<string, string>, stops: string[], generated: string[] }}
 */
export function planReaders(repoRoot, plan, given) {
  const out = { writes: {}, stops: [], generated: [] };
  if (plan.moves.size === 0) return out;
  let readers = given;
  if (!readers) {
    const basenames = [...new Set([...plan.moves.keys()].map((stem) => path.posix.basename(stem)))];
    let listed = [];
    try {
      listed = execFileSync("git", ["grep", "-l", ...basenames.flatMap((name) => ["-e", name]), "--", ...READER_ROOTS], { cwd: repoRoot, encoding: "utf8" }).split("\n");
    } catch {
      listed = [];
    }
    readers = Object.fromEntries(listed.filter((rel) => rel && /\.(ts|tsx|mts|mjs|js)$/.test(rel) && !plan.removes.includes(rel)).map((rel) => [rel, fs.readFileSync(path.join(repoRoot, rel), "utf8")]));
  }
  // 移した後の本文(移るファイル自身の中の相対の道も書き換える)
  const texts = { ...readers };
  for (const [target, text] of Object.entries(plan.writes)) texts[target] = text;
  const fileNames = Object.keys(texts).map((rel) => path.join(repoRoot, rel));
  const host = ts.createCompilerHost({ noResolve: true, noLib: true, allowJs: true, jsx: ts.JsxEmit.Preserve });
  const getSourceFile = host.getSourceFile;
  host.getSourceFile = (fileName, language) => {
    const rel = path.relative(repoRoot, fileName).split(path.sep).join("/");
    return texts[rel] !== undefined ? ts.createSourceFile(fileName, texts[rel], language, true, rel.endsWith(".tsx") ? ts.ScriptKind.TSX : undefined) : getSourceFile(fileName, language);
  };
  const program = ts.createProgram(fileNames, { noResolve: true, noLib: true, allowJs: true, jsx: ts.JsxEmit.Preserve, types: [] }, host);
  const checker = program.getTypeChecker();
  // 移るファイル自身の今の道(相対の読みを、元の場所から解く)
  const originOf = new Map();
  for (const [stem, move] of plan.moves) {
    if (move.whole) originOf.set(`${move.whole}.ts`, `${stem}.ts`);
    for (const target of move.names.values()) originOf.set(`${target.stem}.ts`, `${stem}.ts`);
  }

  for (const [rel, original] of Object.entries(texts)) {
    if (GENERATED_HEAD.test(original.slice(0, 400)) && !plan.writes[rel]) {
      out.generated.push(rel);
      continue;
    }
    const source = program.getSourceFile(path.join(repoRoot, rel));
    if (!source) continue;
    const from = originOf.get(rel) ?? rel; // 相対の指定子を解く場所
    const edits = [];
    const renameSymbols = new Map(); // symbol → new local name
    const handle = (literal, kind, statement) => {
      const specifier = literal.text;
      const stem = resolveSpecifier(repoRoot, from, specifier);
      const move = stem ? plan.moves.get(stem) : null;
      const selfRelative = !move && originOf.has(rel) && specifier.startsWith(".");
      if (!move) {
        // 移るファイルの中の相対の道は、新しい場所から辿り直す
        if (selfRelative && stem) {
          const next = specifierFor(rel, specifier, stem);
          if (next !== specifier) edits.push({ start: literal.getStart(source) + 1, end: literal.getEnd() - 1, text: next });
        }
        return;
      }
      const renamed = [...move.names].filter(([name, target]) => target.name !== name);
      if (move.whole && renamed.length === 0) {
        edits.push({ start: literal.getStart(source) + 1, end: literal.getEnd() - 1, text: specifierFor(rel, specifier, move.whole) });
        return;
      }
      if (kind === "import" && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings) && !statement.importClause.name) {
        const groups = new Map();
        for (const element of statement.importClause.namedBindings.elements) {
          const imported = (element.propertyName ?? element.name).text;
          const target = move.names.get(imported) ?? (move.whole ? { stem: move.whole, name: imported } : null);
          if (!target) {
            out.stops.push(`${rel}: ${imported} を "${specifier}" から読むが、行き先が分からない`);
            return;
          }
          let text = element.getText(source);
          if (target.name !== imported) {
            if (element.propertyName) text = `${element.isTypeOnly ? "type " : ""}${target.name} as ${element.name.text}`;
            else {
              text = `${element.isTypeOnly ? "type " : ""}${target.name}`;
              renameSymbols.set(checker.getSymbolAtLocation(element.name), target.name);
            }
          }
          groups.set(target.stem, [...(groups.get(target.stem) ?? []), text]);
        }
        const typeWord = statement.importClause.isTypeOnly ? "type " : "";
        const lines = [...groups].map(([stem, elements]) => `import ${typeWord}{ ${elements.join(", ")} } from "${specifierFor(rel, specifier, stem)}";`);
        edits.push({ start: statement.getStart(source), end: statement.getEnd(), text: lines.join("\n") });
        return;
      }
      if (kind === "importType" && move.whole) {
        // typeof import("…") / import("…").Name: 道だけ直す(名前の変わる export を型の位置で読むなら名前も)
        edits.push({ start: literal.getStart(source) + 1, end: literal.getEnd() - 1, text: specifierFor(rel, specifier, move.whole) });
        const qualifier = statement.qualifier && ts.isIdentifier(statement.qualifier) ? statement.qualifier : null;
        const target = qualifier ? move.names.get(qualifier.text) : null;
        if (qualifier && target && target.name !== qualifier.text) edits.push({ start: qualifier.getStart(source), end: qualifier.getEnd(), text: target.name });
        return;
      }
      if (kind === "export" && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
        // export { a, b } from: 名前は変えずに出す(名前の変わる export を外へ出すのは止める: 外の読み手の名前が変わる)
        const groups = new Map();
        for (const element of statement.exportClause.elements) {
          const exported = (element.propertyName ?? element.name).text;
          const target = move.names.get(exported) ?? (move.whole ? { stem: move.whole, name: exported } : null);
          if (!target || (target.name !== exported && !element.propertyName)) {
            out.stops.push(`${rel}: export { ${exported} } from "${specifier}" は${target ? `名前が ${target.name} に変わる(外の読み手の名前も変わる)` : "行き先が分からない"}`);
            return;
          }
          const text = target.name !== exported ? `${element.isTypeOnly ? "type " : ""}${target.name} as ${element.name.text}` : element.getText(source);
          groups.set(target.stem, [...(groups.get(target.stem) ?? []), text]);
        }
        const typeWord = statement.isTypeOnly ? "type " : "";
        edits.push({ start: statement.getStart(source), end: statement.getEnd(), text: [...groups].map(([stem, elements]) => `export ${typeWord}{ ${elements.join(", ")} } from "${specifierFor(rel, specifier, stem)}";`).join("\n") });
        return;
      }
      if (kind === "dynamic" && move.whole) {
        // const { a, b: c } = await import("…"): 分割の鍵を見る(名前の変わる鍵は鍵だけ変え、手元の名前は残す)
        let node = statement.parent;
        while (node && (ts.isAwaitExpression(node) || ts.isParenthesizedExpression(node))) node = node.parent;
        const pattern = node && ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name) ? node.name : null;
        if (!pattern) {
          out.stops.push(`${rel}: "${specifier}" を import() で読み、分割の形でないので名前の変わる export(${renamed.map(([name, target]) => `${name} → ${target.name}`).join(", ")})を確かめられない`);
          return;
        }
        edits.push({ start: literal.getStart(source) + 1, end: literal.getEnd() - 1, text: specifierFor(rel, specifier, move.whole) });
        for (const element of pattern.elements) {
          const key = (element.propertyName ?? element.name).getText(source);
          const target = move.names.get(key);
          if (!target || target.name === key) continue;
          if (element.propertyName) edits.push({ start: element.propertyName.getStart(source), end: element.propertyName.getEnd(), text: target.name });
          else edits.push({ start: element.name.getStart(source), end: element.name.getEnd(), text: `${target.name}: ${key}` });
        }
        return;
      }
      if (kind === "mock" && move.whole) {
        edits.push({ start: literal.getStart(source) + 1, end: literal.getEnd() - 1, text: specifierFor(rel, specifier, move.whole) });
        const options = statement.arguments[1];
        const named = options && ts.isObjectLiteralExpression(options) ? options.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText(source) === "namedExports") : null;
        if (named && ts.isObjectLiteralExpression(named.initializer)) {
          for (const property of named.initializer.properties) {
            const key = property.name?.getText(source);
            const target = key ? move.names.get(key) : null;
            if (!target || target.name === key) continue;
            if (ts.isShorthandPropertyAssignment(property)) edits.push({ start: property.getStart(source), end: property.getEnd(), text: `${target.name}: ${key}` });
            else edits.push({ start: property.name.getStart(source), end: property.name.getEnd(), text: target.name });
          }
        }
        return;
      }
      out.stops.push(`${rel}: "${specifier}" を ${kind === "export" ? "export from" : kind === "dynamic" ? "import()" : "import * / default"} で読み、名前の変わる export(${renamed.map(([name, target]) => `${name} → ${target.name}`).join(", ") || "分けたファイル"})を書き換えられない`);
    };
    const visit = (node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) handle(node.moduleSpecifier, "import", node);
      else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument) && ts.isStringLiteral(node.argument.literal)) handle(node.argument.literal, "importType", node);
      else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) handle(node.moduleSpecifier, "export", node);
      else if (ts.isCallExpression(node) && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) {
        const callee = node.expression;
        if (callee.kind === ts.SyntaxKind.ImportKeyword) handle(node.arguments[0], "dynamic", node);
        else if (ts.isPropertyAccessExpression(callee) && ["module"].includes(callee.name.text) && callee.expression.getText(source) === "mock") handle(node.arguments[0], "mock", node);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    if (renameSymbols.size > 0) {
      const declared = new Set();
      const collect = (node) => {
        if ((ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isParameter(node) || ts.isImportSpecifier(node)) && node.name && ts.isIdentifier(node.name)) declared.add(node.name.text);
        ts.forEachChild(node, collect);
      };
      collect(source);
      for (const name of renameSymbols.values()) if (declared.has(name)) out.stops.push(`${rel}: 新しい名前 ${name} が既にある`);
      const refs = (node) => {
        if (ts.isIdentifier(node) && !ts.isImportSpecifier(node.parent)) {
          const parent = node.parent;
          if (ts.isShorthandPropertyAssignment(parent) && parent.name === node) {
            const symbol = checker.getShorthandAssignmentValueSymbol(parent);
            if (renameSymbols.has(symbol)) edits.push({ start: node.getStart(source), end: node.getEnd(), text: `${node.text}: ${renameSymbols.get(symbol)}` });
          } else {
            const symbol = checker.getSymbolAtLocation(node);
            if (symbol && renameSymbols.has(symbol)) edits.push({ start: node.getStart(source), end: node.getEnd(), text: renameSymbols.get(symbol) });
          }
        }
        ts.forEachChild(node, refs);
      };
      refs(source);
    }
    if (edits.length === 0) continue;
    // 重なる編集(import 文の置き換えの中の指定子)は外側だけ
    const sorted = edits.sort((a, b) => b.start - a.start || a.end - b.end);
    let next = original;
    let floor = Infinity;
    for (const edit of sorted) {
      if (edit.end > floor) continue;
      next = `${next.slice(0, edit.start)}${edit.text}${next.slice(edit.end)}`;
      floor = edit.start;
    }
    out.writes[rel] = next;
  }
  return out;
}

async function main() {
  const repoRoot = process.cwd();
  const write = process.argv.includes("--write");
  const plan = planMoves(repoRoot);
  const readers = plan.stops.length > 0 ? { writes: {}, stops: [], generated: [] } : planReaders(repoRoot, plan);
  const stops = [...plan.stops, ...readers.stops];
  for (const line of plan.kept) console.log(`そのまま: ${line}`);
  if (stops.length > 0) {
    console.error(`✗ 止めました(${stops.length} 件。何も書いていない):\n${stops.map((stop) => `  - ${stop}`).join("\n")}`);
    process.exit(1);
  }
  const writes = { ...readers.writes, ...plan.entityJson };
  for (const [target, text] of Object.entries(plan.writes)) writes[target] = readers.writes[target] ?? text;
  console.log(`移す ${plan.removes.length} 本 → 書く ${Object.keys(plan.writes).length} 本、読み手の書き換え ${Object.keys(readers.writes).filter((rel) => !plan.writes[rel]).length} 本、entity.json ${Object.keys(plan.entityJson).length} 本`);
  for (const [stem, move] of plan.moves) {
    const targets = move.whole ? [move.whole] : [...new Set([...move.names.values()].map((target) => target.stem))];
    const renamed = [...move.names].filter(([name, target]) => name !== target.name).map(([name, target]) => `${name} → ${target.name}`);
    console.log(`  ${stem}.ts → ${targets.map((target) => `${target}.ts`).join(" + ")}${renamed.length > 0 ? `(${renamed.join(", ")})` : ""}`);
  }
  if (readers.generated.length > 0) console.log(`生成物は書き換えない(生成器で作り直す): ${readers.generated.join(", ")}`);
  if (!write) {
    console.log("計画だけ(--write で書く)");
    return;
  }
  for (const [rel, text] of Object.entries(writes)) {
    fs.mkdirSync(path.dirname(path.join(repoRoot, rel)), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, rel), text);
  }
  for (const rel of plan.removes) fs.rmSync(path.join(repoRoot, rel));
  console.log("✓ 書きました。続けて pnpm generate registry、生成する登録のあるドメインは pnpm generate domain -- <Domain>");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
