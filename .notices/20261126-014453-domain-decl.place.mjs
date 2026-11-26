// .notices/20261126-014453-domain-decl.place.mjs
// 置き場の道具: 宣言(entities/<登録名>/entity.json)を書いたドメインの表のファイルを、登録ごとのフォルダ entities/<登録名>/ の
// drizzle・schema・form・model へ移し、entities/<種類>.ts を登録のフォルダを集めるだけの入口にする(D335。import の道は変えない)。
// 文の付け方は登録の数によらず 1 つ: 表(pgTable の名前。belongsToMany の中間の表は持ち主の登録)→ 宣言の名前の頭の登録名
// → 使う名前・自分を使う文の付いた先。どれにも付かない文はドメイン全体の物(D341): 型 → <domain>/types/domain.ts、
// 定数・入力の形(zod)・関数 → <domain>/constants/domain.ts。それを entities/ 経由で読む import はリポジトリの全部で書き換える
// - 登録 1 つのドメイン: 4 ファイルをそのまま移し(ドメイン全体の文だけ抜く)、中の相対の import を 1 段深く直す
// - 登録が複数: entities/ の 4 ファイルと表を持つ手のファイル(messaging の delivery.ts など)を文ごとに登録へ分ける。種類は 4 ファイルならその名前、
//   手のファイルは表の物(pgTable・pgEnum・表を使う文)= drizzle、型 = model、zod = schema。登録をまたぐ export しない名前は止める
// 守り(書く前): 前後で出す名前の集まりが同じ(ドメイン全体の物へ移る名前を除く)・集める入口の名前がぶつからない・全部の表の事実が同じ・
// 消す手のファイルを読む所が無い・移る名前を外から export * で出す所が無い・ドメイン全体のファイルに同じ名前が無い。
// 崩れたドメインは書かずに止めて理由を出す。
//
// 使い方(リポのルートで、declare --write の後。tsx の上): npx tsx .notices/20261126-014453-domain-decl.place.mjs [--write] [--domain=<名前>]

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import ts from "typescript";

import { nodeDomainSource, readDomains } from "../src/lib/domain/node.mjs";
import { toPascalCase, toSnakeCase } from "../src/lib/stringCase/index.mjs";
import { ENTITY_KINDS, moveIntoRegistration } from "../scripts/structure/domain/render/entities/collector.mjs";
import { renderEntityCollector } from "../scripts/structure/registry/alpha/entityCollectors.mjs";
import { diffTableFacts, tableFactsOf } from "../scripts/structure/domain-tables/facts.mjs";
import { makeTempDir, resolveRepoImport } from "../scripts/structure/domain-tables/tables.mjs";

const COLLECTOR_NOTE = "を集めるだけの入口";
/** 生成物の頭の印(生成器の GENERATED_MARK と、registry などの「生成物・編集不可」) */
const GENERATED_HEAD = /AUTO-GENERATED|生成物・編集不可/;
const SKIP_FILES = new Set(["index.ts", "display.ts"]);

/** @param {string} text @param {string} name */
const sourceOf = (text, name) => ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

/** 文が宣言する名前 */
function declaredNames(statement) {
  if (ts.isVariableStatement(statement)) return statement.declarationList.declarations.flatMap((d) => (ts.isIdentifier(d.name) ? [d.name.text] : []));
  if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement) || ts.isEnumDeclaration(statement)) && statement.name) {
    return [statement.name.text];
  }
  return [];
}

const isExported = (statement) => Boolean(ts.getCombinedModifierFlags(statement) & ts.ModifierFlags.Export) || (ts.canHaveModifiers(statement) && (ts.getModifiers(statement) ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword));
const isTypeOnly = (statement) => ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement);

/** 文の中で使う名前(識別子の全部) */
function usedNames(node, out = new Set()) {
  if (ts.isIdentifier(node)) out.add(node.text);
  // forEachChild は callback が真の値を返すと止まるので、何も返さない
  node.forEachChild((child) => {
    usedNames(child, out);
  });
  return out;
}

/** ファイルが出す名前(export の宣言・export { }・export * from の先は呼び手が足す) */
export function exportedNamesOf(text, name = "x.ts") {
  const source = sourceOf(text, name);
  const names = new Set();
  const starFrom = [];
  for (const statement of source.statements) {
    if (isExported(statement)) for (const declared of declaredNames(statement)) names.add(declared);
    if (ts.isExportDeclaration(statement)) {
      if (!statement.exportClause && statement.moduleSpecifier) starFrom.push(statement.moduleSpecifier.text);
      else if (statement.exportClause && ts.isNamedExports(statement.exportClause)) for (const element of statement.exportClause.elements) names.add(element.name.text);
    }
  }
  return { names, starFrom };
}

/** どの表にも属さないドメイン全体の文の置き場(D341): 型 → types/、定数と入力の形(zod の値)・関数 → constants/(ドメインのフォルダからの相対) */
export const DOMAIN_WIDE_FILES = { types: "types/domain.ts", constants: "constants/domain.ts" };
const DOMAIN_WIDE_NOTE = "どの表にも属さないドメイン全体の";

/** belongsToMany の中間の表の物理名(生成器 render/entities/drizzle/junction.mjs と同じ: snake(<Singular>To<Relation>)) */
export function junctionTablesOf(entity) {
  const singular = typeof entity.singular === "string" ? entity.singular : null;
  if (!singular || !Array.isArray(entity.relations)) return [];
  return entity.relations
    .filter((rel) => rel && rel.relationType === "belongsToMany" && rel.includeRelationTable !== false && typeof rel.domain === "string")
    .map((rel) => toSnakeCase(`${toPascalCase(singular)}To${toPascalCase(rel.domain)}`));
}

/** 文の全文(前の空行と、ファイルの頭の道の注記を除く) */
const statementText = (statement, source) => statement.getFullText(source).replace(/^\s*\n/, "").replace(/^\/\/ src\/domains\/[^\n]*\n(\/\/\n)?/, "");

/** import の文から名前 → { specifier, typeOnly, clause, namespace } */
function importsOf(source) {
  const imported = new Map();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const specifier = statement.moduleSpecifier.text;
    const clause = statement.importClause;
    const typeOnly = Boolean(clause?.isTypeOnly);
    const bindings = clause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        imported.set(element.name.text, { specifier, typeOnly: typeOnly || element.isTypeOnly, clause: element.propertyName ? `${element.propertyName.text} as ${element.name.text}` : element.name.text });
      }
    }
    if (bindings && ts.isNamespaceImport(bindings)) imported.set(bindings.name.text, { specifier, typeOnly, clause: bindings.name.text, namespace: true });
    if (clause?.name) imported.set(clause.name.text, { specifier, typeOnly, clause: `default as ${clause.name.text}` });
  }
  return imported;
}

/** 必要な名前の import の行(道ごとに値・型を分けてまとめる) */
function importLinesOf(needs) {
  const bySpecifier = new Map();
  const namespaces = [];
  for (const need of needs.values()) {
    if (need.namespace) {
      namespaces.push(`import ${need.typeOnly ? "type " : ""}* as ${need.clause} from "${need.specifier}";`);
      continue;
    }
    const entry = bySpecifier.get(need.specifier) ?? { values: [], types: [] };
    (need.typeOnly ? entry.types : entry.values).push(need.clause);
    bySpecifier.set(need.specifier, entry);
  }
  return [
    ...namespaces.sort(),
    ...[...bySpecifier]
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([specifier, { values, types }]) => [
        ...(values.length > 0 ? [`import { ${[...new Set(values)].sort().join(", ")} } from "${specifier}";`] : []),
        ...(types.length > 0 ? [`import type { ${[...new Set(types)].sort().join(", ")} } from "${specifier}";`] : []),
      ]),
  ];
}

/**
 * 1 つのドメインの置き場の計画(ファイルの中身だけから。書かない)
 * 文の付け方は登録の数によらず 1 つ: 表(pgTable の名前・belongsToMany の中間の表は持ち主)→ 名前の頭の登録名 → 使う名前 / 自分を使う文の付いた先。
 * どれにも付かない文はドメイン全体の物(D341): 型 → types/domain.ts、ほか → constants/domain.ts(今のファイルがあれば足す)
 * @param {{ domainRel: string, registrations: { name: string, table: string | null, junctions?: string[] }[], files: Record<string, string>, domainFiles?: Record<string, string> }} input
 *   files = entities/ 直下のファイル名 → 本文、domainFiles = DOMAIN_WIDE_FILES の今の本文(あれば)
 * @returns {{ domainRel: string, writes: Record<string, string>, removes: string[], stops: string[], tables: string[], moved: Map<string, { file: string, typeOnly: boolean }> }}
 *   道はリポジトリ相対。moved = ドメイン全体の物へ移る export の名前 → 移り先(ドメインのフォルダからの相対、拡張子なし)
 */
export function planPlacement(input) {
  const { domainRel, registrations, files } = input;
  const domainFiles = input.domainFiles ?? {};
  const entities = `${domainRel}/entities`;
  const result = { domainRel, writes: {}, removes: [], stops: [], tables: [], moved: new Map() };
  const kindFiles = ENTITY_KINDS.filter((kind) => files[`${kind}.ts`] !== undefined);
  if (kindFiles.some((kind) => files[`${kind}.ts`].includes(COLLECTOR_NOTE))) return result; // 置いた後(何度走らせても同じ)
  const candidates = Object.keys(files).filter((file) => file.endsWith(".ts") && !SKIP_FILES.has(file) && !/\.test\.tsx?$/.test(file));
  const topicFiles = candidates.filter((file) => !ENTITY_KINDS.includes(file.replace(/\.ts$/, "")) && /\bpgTable\s*\(/.test(files[file]));
  for (const file of [...kindFiles.map((kind) => `${kind}.ts`), ...topicFiles]) {
    for (const match of files[file].matchAll(/\bpgTable\s*\(\s*["'`]([^"'`]+)["'`]/g)) result.tables.push(match[1]);
  }
  const single = registrations.length === 1;
  if (single && topicFiles.length > 0) {
    result.stops.push(`${entities}: 登録 1 つのドメインに表を持つ手のファイル ${topicFiles.join(", ")} がある(置き方を決める)`);
    return result;
  }

  // 文を読む
  const byTable = new Map();
  for (const registration of registrations) {
    byTable.set(registration.table, registration.name);
    for (const junction of registration.junctions ?? []) if (!byTable.has(junction)) byTable.set(junction, registration.name);
  }
  const pascals = registrations.map((registration) => [toPascalCase(registration.name), registration.name]).sort((a, b) => b[0].length - a[0].length);
  /** @type {{ file: string, statement: ts.Statement, source: ts.SourceFile, text: string, names: string[], uses: Set<string>, kind: string | null, registration: string | null, wide: boolean, exported: boolean, typeOnly: boolean }[]} */
  const items = [];
  const sources = new Map();
  const importsByFile = new Map();
  for (const file of [...kindFiles.map((kind) => `${kind}.ts`), ...topicFiles]) {
    const source = sourceOf(files[file], file);
    sources.set(file, source);
    importsByFile.set(file, importsOf(source));
    const fileKind = ENTITY_KINDS.includes(file.replace(/\.ts$/, "")) ? file.replace(/\.ts$/, "") : null;
    for (const statement of source.statements) {
      if (ts.isImportDeclaration(statement)) continue;
      if (ts.isExportDeclaration(statement)) {
        if (single) continue; // 登録 1 つ: ファイルごと移るので、そのまま残る
        // 手のファイルを集めていた export * from "./x" は、集める入口が代わる
        if (!statement.exportClause && statement.moduleSpecifier && topicFiles.includes(`${statement.moduleSpecifier.text.replace(/^\.\//, "")}.ts`)) continue;
        result.stops.push(`${entities}/${file}: export の文 "${statement.getText().slice(0, 60)}" を登録に付けられない`);
        continue;
      }
      const tableName = /\bpgTable\s*\(\s*["'`]([^"'`]+)["'`]/.exec(statement.getText())?.[1] ?? null;
      const names = declaredNames(statement);
      const uses = usedNames(statement);
      for (const name of names) uses.delete(name);
      let kind = fileKind;
      if (!kind) {
        const body = statement.getText();
        kind = /\b(pgTable|pgEnum|relations|defineHiddenColumns|defineTableCollections)\s*\(/.test(body) ? "drizzle" : isTypeOnly(statement) ? "model" : /\bz\./.test(body) ? "schema" : null;
      }
      let registration = tableName ? (byTable.get(tableName) ?? null) : null;
      if (tableName && !registration) result.stops.push(`${entities}/${file}: 表 ${tableName} がどの登録(entity.json の table / plural)にも、その belongsToMany の中間の表にも無い`);
      if (!registration && names.length > 0) registration = names.map((name) => pascals.find(([pascal, reg]) => name.startsWith(pascal) || name.startsWith(reg))?.[1]).find(Boolean) ?? null;
      // 名前を持たない文(式の文など)はファイルと一緒に動く
      if (!registration && names.length === 0 && single) registration = registrations[0].name;
      items.push({ file, statement, source, text: statementText(statement, source), names, uses, kind, registration, wide: false, exported: isExported(statement), typeOnly: isTypeOnly(statement) });
    }
  }
  if (result.stops.length > 0) return result;

  // 名前で付かない文: 使う名前の付いた先、それも無ければ自分を使う文の付いた先(変わらなくなるまで)
  // 名前の持ち主: 同じファイルの宣言を先に(別のファイルに同じ名前の export しない定数があっても取り違えない)、無ければ export した物
  const ownerOf = (name, file, filter = () => true) => {
    const found = items.filter((item) => item.names.includes(name) && filter(item));
    return found.find((item) => item.file === file) ?? found.find((item) => item.exported) ?? found[0] ?? null;
  };
  for (let changed = true; changed; ) {
    changed = false;
    for (const item of items.filter((candidate) => !candidate.registration)) {
      const used = [...item.uses].map((name) => ownerOf(name, item.file, (owner) => Boolean(owner.registration))).find(Boolean);
      const user = items.find((other) => other.registration && item.names.some((name) => other.uses.has(name) && ownerOf(name, other.file) === item));
      const registration = used?.registration ?? user?.registration ?? null;
      if (registration) {
        item.registration = registration;
        if (!item.kind) item.kind = (used ?? user).kind;
        changed = true;
      }
    }
  }
  // どれにも付かない文 = ドメイン全体の物
  for (const item of items) {
    if (item.registration && item.kind) continue;
    if (item.registration && !item.kind) {
      result.stops.push(`${entities}/${item.file}: 文 "${item.statement.getText().split("\n")[0].slice(0, 70)}" の種類が分からない`);
      continue;
    }
    item.wide = true;
    item.kind = item.typeOnly ? "types" : "constants";
    for (const name of item.names) if (item.exported) result.moved.set(name, { file: DOMAIN_WIDE_FILES[item.kind].replace(/\.ts$/, ""), typeOnly: item.typeOnly });
  }
  if (result.stops.length > 0) return result;

  /** 文が使う名前の import(書く先のファイル rel から) */
  const needsOf = (group, rel, sameKey) => {
    const needs = new Map();
    const typesFile = rel === `${domainRel}/${DOMAIN_WIDE_FILES.types}`; // 型だけのファイル: import は全部 import type
    for (const item of group) {
      const imported = importsByFile.get(item.file);
      for (const name of item.uses) {
        const owner = ownerOf(name, item.file);
        if (owner && owner !== item && `${owner.wide ? "" : owner.registration}/${owner.kind}` !== sameKey) {
          if (!owner.exported) {
            result.stops.push(`${entities}: ${name} は export されずに ${owner.wide ? DOMAIN_WIDE_FILES[owner.kind] : `${owner.registration}/${owner.kind}`} と ${rel} の両方で使われる`);
            continue;
          }
          const target = owner.wide ? `${domainRel}/${DOMAIN_WIDE_FILES[owner.kind].replace(/\.ts$/, "")}` : `${entities}/${owner.registration}/${owner.kind}`;
          needs.set(name, { specifier: relativeSpecifier(rel, target), typeOnly: owner.typeOnly || typesFile, clause: name });
        } else if (!owner && imported.has(name)) {
          const from = imported.get(name);
          const target = from.specifier.replace(/^\.\//, "");
          let specifier = from.specifier;
          if (from.specifier.startsWith(".")) {
            const sameEntities = from.specifier.startsWith("./") && (ENTITY_KINDS.includes(target) || topicFiles.includes(`${target}.ts`));
            // 同じ entities の物: 集める入口から(手のファイルの名前は上で付いている)
            const absolute = sameEntities ? `${entities}/${ENTITY_KINDS.includes(target) ? target : "drizzle"}` : path.posix.normalize(`${entities}/${from.specifier}`);
            specifier = relativeSpecifier(rel, absolute);
          }
          needs.set(name, { ...from, specifier, typeOnly: from.typeOnly || typesFile });
        }
      }
    }
    return needs;
  };

  if (single) {
    // 登録 1 つ: ファイルを丸ごと移す(ドメイン全体の文だけ抜き、使わなくなった import を落とす)
    const [registration] = registrations;
    for (const kind of kindFiles) {
      const file = `${kind}.ts`;
      const wideHere = items.filter((item) => item.wide && item.file === file);
      let text = files[file];
      if (wideHere.length > 0) text = withoutStatements(sources.get(file), wideHere.map((item) => item.statement), items.filter((item) => !item.wide && item.file === file));
      result.writes[`${entities}/${registration.name}/${kind}.ts`] = moveIntoRegistration(text, { domainRel, registration: registration.name, kind, siblings: kindFiles });
      result.writes[`${entities}/${kind}.ts`] = renderEntityCollector(domainRel, kind, [registration.name]);
    }
  } else {
    // 登録が複数: 登録ごと・種類ごとのファイルを組む
    /** @type {Map<string, typeof items>} */
    const groups = new Map();
    for (const item of items.filter((candidate) => !candidate.wide)) {
      const key = `${item.registration}/${item.kind}`;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    for (const [key, group] of groups) {
      const [registration, kind] = key.split("/");
      const rel = `${entities}/${registration}/${kind}.ts`;
      const importLines = importLinesOf(needsOf(group, rel, key));
      result.writes[rel] = [`// ${rel}`, "", ...importLines, "", ...group.map((item) => item.text.trimEnd()), ""].join("\n").replace(/\n{3,}/g, "\n\n");
    }
    for (const kind of ENTITY_KINDS) {
      const regs = registrations.map((registration) => registration.name).filter((name) => groups.has(`${name}/${kind}`));
      if (regs.length > 0 || kindFiles.includes(kind)) result.writes[`${entities}/${kind}.ts`] = renderEntityCollector(domainRel, kind, regs);
    }
    for (const file of topicFiles) result.removes.push(`${entities}/${file}`);
  }

  // ドメイン全体の物(D341)
  for (const wideKind of ["types", "constants"]) {
    const group = items.filter((item) => item.wide && item.kind === wideKind);
    if (group.length === 0) continue;
    const rel = `${domainRel}/${DOMAIN_WIDE_FILES[wideKind]}`;
    const importLines = importLinesOf(needsOf(group, rel, `/${wideKind}`));
    const body = group.map((item) => item.text.trimEnd());
    const existing = domainFiles[DOMAIN_WIDE_FILES[wideKind]];
    if (existing === undefined) {
      result.writes[rel] = [`// ${rel}`, `// ${DOMAIN_WIDE_NOTE}${wideKind === "types" ? "型" : "定数と入力の形"}(entities/<登録名>/ にはその表の物だけ)`, "", ...importLines, "", ...body, ""].join("\n").replace(/\n{3,}/g, "\n\n");
      continue;
    }
    const taken = new Set(sourceOf(existing, rel).statements.flatMap((statement) => declaredNames(statement)));
    for (const [name] of importsOf(sourceOf(existing, rel))) taken.add(name);
    const clash = group.flatMap((item) => item.names).filter((name) => taken.has(name));
    if (clash.length > 0) {
      result.stops.push(`${rel}: 今のファイルに同じ名前がある: ${clash.join(", ")}`);
      continue;
    }
    const existingSource = sourceOf(existing, rel);
    const lastImport = [...existingSource.statements].filter((statement) => ts.isImportDeclaration(statement)).pop();
    const at = lastImport ? lastImport.getEnd() : 0;
    const head = existing.slice(0, at);
    const tail = existing.slice(at);
    result.writes[rel] = `${head}${importLines.length > 0 ? `${at > 0 ? "\n" : ""}${importLines.join("\n")}\n` : ""}${tail.trimEnd()}\n\n${body.join("\n\n")}\n`.replace(/\n{3,}/g, "\n\n");
  }
  return result;
}

/** 書く先 rel から target(拡張子なし、リポジトリ相対)への相対の道 */
function relativeSpecifier(rel, target) {
  const relative = path.posix.relative(path.posix.dirname(rel), target);
  return relative.startsWith(".") ? relative : `./${relative}`;
}

/** ファイルから文を抜き、残りの文が使わなくなった import の名前を落とす */
function withoutStatements(source, statements, kept) {
  const cut = new Set(statements);
  const keptUses = new Set();
  for (const item of kept) for (const name of item.uses) keptUses.add(name);
  // export の文(登録 1 つで残る物)も名前を使う
  for (const statement of source.statements) if (ts.isExportDeclaration(statement)) usedNames(statement, keptUses);
  let out = "";
  let last = 0;
  const text = source.getFullText();
  for (const statement of source.statements) {
    if (cut.has(statement)) {
      out += text.slice(last, statement.getFullStart());
      last = statement.getEnd();
      continue;
    }
    if (ts.isImportDeclaration(statement) && statement.importClause) {
      const clause = statement.importClause;
      const bindings = clause.namedBindings;
      const keepDefault = clause.name && keptUses.has(clause.name.text);
      const keepNamespace = bindings && ts.isNamespaceImport(bindings) && keptUses.has(bindings.name.text);
      const elements = bindings && ts.isNamedImports(bindings) ? bindings.elements.filter((element) => keptUses.has(element.name.text)) : [];
      const all = bindings && ts.isNamedImports(bindings) ? bindings.elements.length : 0;
      if (keepDefault === Boolean(clause.name) && (!bindings || ts.isNamespaceImport(bindings) ? Boolean(keepNamespace) === Boolean(bindings) : elements.length === all)) continue;
      out += text.slice(last, statement.getStart());
      last = statement.getEnd();
      if (!keepDefault && !keepNamespace && elements.length === 0) continue;
      const parts = [
        ...(keepDefault ? [clause.name.text] : []),
        ...(keepNamespace ? [`* as ${bindings.name.text}`] : []),
        ...(elements.length > 0 ? [`{ ${elements.map((element) => element.getText()).join(", ")} }`] : []),
      ];
      out += `import ${clause.isTypeOnly ? "type " : ""}${parts.join(", ")} from ${statement.moduleSpecifier.getText()};`;
    }
  }
  out += text.slice(last);
  return out.replace(/\n{3,}/g, "\n\n");
}


/**
 * 守り: 前後で出す名前の集まりが同じ(ドメイン全体の物へ移った名前を除く)・集める入口の名前がぶつからない(ファイルの中身だけから)
 * @returns {string[]} 崩れ
 */
export function checkExports(input, plan) {
  const entities = `${input.domainRel}/entities`;
  const before = new Set();
  const touched = [...Object.keys(plan.writes), ...plan.removes].filter((rel) => rel.startsWith(`${entities}/`) && rel.split("/").length === entities.split("/").length + 1);
  for (const rel of touched) {
    const text = input.files[rel.slice(entities.length + 1)];
    if (text === undefined) continue;
    for (const name of exportedNamesOf(text).names) before.add(name);
  }
  const after = new Set();
  const problems = [];
  for (const kind of ENTITY_KINDS) {
    const seen = new Map();
    for (const [rel, text] of Object.entries(plan.writes)) {
      if (!rel.startsWith(`${entities}/`) || !rel.endsWith(`/${kind}.ts`) || rel === `${entities}/${kind}.ts`) continue;
      for (const name of exportedNamesOf(text).names) {
        if (seen.has(name)) problems.push(`${entities}/${kind}.ts: 名前 ${name} が ${seen.get(name)} と ${rel} の両方から出る(export * でぶつかる)`);
        seen.set(name, rel);
        after.add(name);
      }
    }
  }
  // ドメイン全体の物(D341)へ移った名前は入口から消えてよい(読み手は planReaders が書き換える)
  for (const name of plan.moved?.keys() ?? []) after.add(name);
  const lost = [...before].filter((name) => !after.has(name)).sort();
  const added = [...after].filter((name) => !before.has(name)).sort();
  if (lost.length > 0) problems.push(`${entities}: 出していた名前が無くなる: ${lost.join(", ")}`);
  if (added.length > 0) problems.push(`${entities}: 出す名前が増える: ${added.join(", ")}`);
  return problems;
}

/** readersOfRemoved の 1 行の読み手のファイル */
export const readerOf = (line) => /を読む所: ([^:]+):/.exec(line)?.[1] ?? null;

/** 守り: 消す手のファイルをリポジトリの中で読む所(git grep) */
export function readersOfRemoved(repoRoot, removes) {
  const problems = [];
  for (const rel of removes) {
    const stem = rel.replace(/\.ts$/, "");
    const base = path.basename(stem);
    let lines = "";
    try {
      lines = execFileSync("git", ["grep", "-n", "-E", `["'][^"']*entities/${base}["']`, "--", "src", "scripts", "eslint-rules"], { cwd: repoRoot, encoding: "utf8" });
    } catch {
      lines = "";
    }
    const domainRel = rel.slice(0, rel.indexOf("/entities/"));
    for (const line of lines.split("\n").filter(Boolean)) {
      if (line.startsWith(`${domainRel}/entities/`)) continue;
      problems.push(`${rel} を読む所: ${line.slice(0, 160)}`);
    }
  }
  return problems;
}

/** import の道 specifier(rel から)がドメイン domainRel の entities/ の入口(entities・entities/<file>)を指すか(ファイルを開かず道だけで) */
function readsEntities(domainRel, rel, specifier) {
  const target = targetOf(domainRel, rel, specifier);
  return Boolean(target) && (target === `${domainRel}/entities` || path.posix.dirname(target) === `${domainRel}/entities`);
}

/** import の道 specifier(rel から)が指すドメイン domainRel の中のファイル(リポジトリ相対、拡張子と /index なし)。ドメインの外・パッケージは null */
function targetOf(domainRel, rel, specifier) {
  let target = null;
  if (specifier.startsWith("@/domains/")) {
    const rest = specifier.slice("@/domains/".length);
    const domainPath = domainRel.slice("src/domains/".length); // core/user | user
    const alias = domainPath.replace(/^core\//, "");
    if (rest.startsWith(`${domainPath}/`)) target = `${domainRel}/${rest.slice(domainPath.length + 1)}`;
    else if (rest.startsWith(`${alias}/`)) target = `${domainRel}/${rest.slice(alias.length + 1)}`;
  } else if (specifier.startsWith(".")) target = path.posix.normalize(`${path.posix.dirname(rel)}/${specifier}`);
  if (!target || !target.startsWith(`${domainRel}/`)) return null;
  return target.replace(/\.(ts|tsx|mjs|js)$/, "").replace(/\/index$/, "");
}

/**
 * ドメイン全体の物へ移った名前を entities/ 経由で読む import・export from を、新しい道へ書き換える(リポジトリの全部: src・scripts・tests・eslint-rules)
 * 1 つの文の中で行き先が分かれれば、文を分ける。entities の入口から読み続ける名前はそのまま
 * @param {string} repoRoot
 * @param {{ domainRel: string, writes: Record<string, string>, removes: string[], moved: Map<string, { file: string, typeOnly: boolean }> }} plan
 * @param {Record<string, string>} [given] 読み手の道 → 本文(テスト用。省略 = git grep で探してファイルを読む)
 * @returns {{ writes: Record<string, string>, stops: string[] }}
 */
export function planReaders(repoRoot, plan, given) {
  const out = { writes: {}, stops: [], generated: [] };
  const removedStems = new Set(plan.removes.map((rel) => rel.replace(/\.ts$/, "")));
  if (plan.moved.size === 0 && removedStems.size === 0) return out;
  let readers = given;
  if (!readers) {
    const grep = (args) => {
      try {
        return execFileSync("git", ["grep", "-l", ...args, "--", "src", "scripts", "tests", "eslint-rules"], { cwd: repoRoot, encoding: "utf8" }).split("\n");
      } catch {
        return [];
      }
    };
    const listed = new Set([
      ...(plan.moved.size > 0 ? grep(["-w", ...[...plan.moved.keys()].flatMap((name) => ["-e", name])]) : []),
      ...(removedStems.size > 0 ? grep(["-E", ...[...removedStems].flatMap((stem) => ["-e", `entities/${path.posix.basename(stem)}["']`])]) : []),
    ]);
    readers = Object.fromEntries([...listed].filter((rel) => rel && /\.(ts|tsx|mts|mjs|js)$/.test(rel) && plan.writes[rel] === undefined && !plan.removes.includes(rel)).map((rel) => [rel, fs.readFileSync(path.join(repoRoot, rel), "utf8")]));
  }
  for (const [rel, original] of Object.entries(readers)) {
    if (plan.writes[rel] !== undefined) continue;
    // 生成物(schemaRegistry など)は書き換えず、その生成器で作り直す
    if (GENERATED_HEAD.test(original.slice(0, 400))) {
      out.generated.push(rel);
      continue;
    }
    // 消す手のファイル(entities/<話題>.ts)を読む道は、表の物を出す集める入口 entities/drizzle へ
    const text = original.replace(/(from\s+|import\s*\(\s*)(["'])([^"']+)\2/g, (whole, head, quote, specifier) => {
      const target = targetOf(plan.domainRel, rel, specifier);
      if (!target || !removedStems.has(target)) return whole;
      const next = specifier.replace(/[^/]+$/, "drizzle");
      return `${head}${quote}${next}${quote}`;
    });
    const source = sourceOf(text, rel);
    const edits = [];
    for (const statement of source.statements) {
      const isImport = ts.isImportDeclaration(statement);
      const isExportFrom = ts.isExportDeclaration(statement) && statement.moduleSpecifier;
      if (!isImport && !isExportFrom) continue;
      const specifier = statement.moduleSpecifier.text;
      if (!readsEntities(plan.domainRel, rel, specifier)) continue;
      const bindings = isImport ? statement.importClause?.namedBindings : statement.exportClause;
      // entities/ の中(index.ts など)の export * は、読み手が名前で書き換わるのでそのまま。外の export * は名前が出なくなる
      if (isExportFrom && !bindings && !rel.startsWith(`${plan.domainRel}/entities/`)) {
        out.stops.push(`${rel}: export * from "${specifier}" から移る名前(${[...plan.moved.keys()].join(", ")})が出なくなる`);
        continue;
      }
      if (!bindings || !(ts.isNamedImports(bindings) || ts.isNamedExports(bindings))) continue;
      const declTypeOnly = isImport ? Boolean(statement.importClause?.isTypeOnly) : Boolean(statement.isTypeOnly);
      const stay = [];
      const go = new Map();
      for (const element of bindings.elements) {
        const original = (element.propertyName ?? element.name).text;
        const moved = plan.moved.get(original);
        if (!moved) {
          stay.push(element.getText());
          continue;
        }
        const target = specifier.startsWith("@/")
          ? specifier.replace(/\/entities(\/[^/]+)?$/, `/${moved.file}`)
          : relativeSpecifier(rel, `${plan.domainRel}/${moved.file}`);
        go.set(target, [...(go.get(target) ?? []), element.getText()]);
      }
      if (go.size === 0) continue;
      const keyword = isImport ? "import" : "export";
      const typeWord = declTypeOnly ? "type " : "";
      const lines = [
        ...(stay.length > 0 || (isImport && statement.importClause?.name) ? [`${keyword} ${typeWord}${isImport && statement.importClause?.name ? `${statement.importClause.name.text}${stay.length > 0 ? ", " : ""}` : ""}${stay.length > 0 ? `{ ${stay.join(", ")} }` : ""} from "${specifier}";`] : []),
        ...[...go].map(([target, elements]) => `${keyword} ${typeWord}{ ${elements.join(", ")} } from "${target}";`),
      ];
      edits.push({ start: statement.getStart(source), end: statement.getEnd(), text: lines.join("\n") });
    }
    if (edits.length === 0) {
      if (text !== original) out.writes[rel] = text;
      continue;
    }
    let next = text;
    for (const edit of edits.sort((a, b) => b.start - a.start)) next = `${next.slice(0, edit.start)}${edit.text}${next.slice(edit.end)}`;
    out.writes[rel] = next;
  }
  return out;
}

/** 守り: 置いた後の木(一時フォルダ)の表の事実が、今の表と同じか */
async function checkTables(repoRoot, plan, tempDir) {
  // 一時の木に置くのは、表を組む物(entities/ とドメイン全体のファイル)だけ。読み手の書き換えは表の事実に関わらない
  const wide = new Set(Object.values(DOMAIN_WIDE_FILES).map((rel) => `${plan.domainRel}/${rel}`));
  const inTree = new Set(Object.keys(plan.writes).filter((rel) => rel.startsWith(`${plan.domainRel}/entities/`) || wide.has(rel)));
  const tempOf = (rel) => path.join(tempDir, rel);
  const resolveFor = (rel, specifier) => {
    if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return import.meta.resolve(specifier);
    const stem = targetOf(plan.domainRel, rel, specifier);
    const candidate = stem ? [`${stem}.ts`, `${stem}/index.ts`].find((file) => inTree.has(file)) : null;
    if (candidate) return pathToFileURL(tempOf(candidate)).href;
    const real = resolveRepoImport(repoRoot, specifier, path.join(repoRoot, rel));
    if (!real) throw new Error(`${rel}: import "${specifier}" のファイルが見つからない`);
    return pathToFileURL(real).href;
  };
  for (const rel of inTree) {
    const target = tempOf(rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, plan.writes[rel].replace(/(from\s+|import\s*\(\s*)(["'])([^"']+)\2/g, (whole, head, quote, specifier) => `${head}${quote}${resolveFor(rel, specifier)}${quote}`));
  }
  const problems = [];
  const drizzleFiles = Object.keys(plan.writes).filter((rel) => /\/entities\/[^/]+\/drizzle\.ts$/.test(rel));
  const placed = new Map();
  for (const rel of drizzleFiles) {
    for (const value of Object.values(await import(pathToFileURL(tempOf(rel)).href))) if (is(value, PgTable)) placed.set(getTableConfig(value).name, value);
  }
  const { readDistrictMapAt } = await import("../src/lib/districtMap/node.mjs");
  const tableFiles = readDistrictMapAt(repoRoot).tableFiles;
  for (const name of plan.tables) {
    const found = tableFiles.find((table) => table.name === name);
    const now = found ? Object.values(await import(pathToFileURL(path.join(repoRoot, found.file)).href)).find((value) => is(value, PgTable) && getTableConfig(value).name === name) : null;
    const next = placed.get(name);
    if (!now || !next) {
      problems.push(`表 ${name}: ${!now ? "今の表" : "置いた後の表"}が読めない`);
      continue;
    }
    problems.push(...diffTableFacts(tableFactsOf(now), tableFactsOf(next)));
  }
  return problems;
}

/**
 * 置き場の計画の入力: 登録(名前・表の物理名・belongsToMany の中間の表)と entities/ 直下のファイルと、ドメイン全体の物の今のファイル
 * @param {string} repoRoot
 * @param {string} domainRel
 * @param {{ name: string, entity: Record<string, unknown> }[]} registrations Neon の登録
 */
export function placementInput(repoRoot, domainRel, registrations) {
  const entitiesDir = path.join(repoRoot, domainRel, "entities");
  const files = fs.existsSync(entitiesDir)
    ? Object.fromEntries(fs.readdirSync(entitiesDir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => [e.name, fs.readFileSync(path.join(entitiesDir, e.name), "utf8")]))
    : {};
  return {
    domainRel,
    registrations: registrations.map((r) => ({ name: r.name, table: typeof r.entity.table === "string" ? r.entity.table : toSnakeCase(typeof r.entity.plural === "string" ? r.entity.plural : r.name), junctions: junctionTablesOf(r.entity) })),
    files,
    domainFiles: Object.fromEntries(Object.values(DOMAIN_WIDE_FILES).flatMap((rel) => {
      const file = path.join(repoRoot, domainRel, rel);
      return fs.existsSync(file) ? [[rel, fs.readFileSync(file, "utf8")]] : [];
    })),
  };
}

/** 書く(git mv はしない: 新しい中身を書いて古い手のファイルを消す。git は名前の変わりを中身の近さで見る) */
function writePlacement(repoRoot, plan) {
  for (const [rel, text] of Object.entries(plan.writes)) {
    fs.mkdirSync(path.dirname(path.join(repoRoot, rel)), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, rel), text);
  }
  for (const rel of plan.removes) fs.rmSync(path.join(repoRoot, rel));
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const only = args.find((arg) => arg.startsWith("--domain="))?.slice("--domain=".length);
  const repoRoot = process.cwd();
  const tempDir = makeTempDir();
  let stopped = 0;
  let count = 0;
  try {
    for (const domain of readDomains(nodeDomainSource(repoRoot))) {
      if ((only && domain.name !== only) || domain.registrations.length === 0 || domain.registrations.some((r) => r.entity === null)) continue;
      const neon = domain.registrations.filter((r) => (r.entity.dbEngine ?? "Neon") === "Neon");
      if (neon.length === 0) continue;
      count++;
      const input = placementInput(repoRoot, domain.dir, neon);
      const plan = planPlacement(input);
      if (Object.keys(plan.writes).length === 0 && plan.stops.length === 0) {
        console.log(`## ${domain.name}: 置いてある(何もしない)`);
        continue;
      }
      const problems = [...plan.stops];
      if (problems.length === 0) {
        const readers = planReaders(repoRoot, plan);
        const handled = new Set([...Object.keys(readers.writes), ...readers.generated]);
        problems.push(...readers.stops, ...checkExports(input, plan), ...readersOfRemoved(repoRoot, plan.removes).filter((line) => !handled.has(readerOf(line))));
        Object.assign(plan.writes, readers.writes);
        if (Object.keys(readers.writes).length > 0) console.log(`- 読み手を書き換える: ${Object.keys(readers.writes).length} ファイル${plan.moved.size > 0 ? `(移る名前 ${[...plan.moved.keys()].join(", ")})` : ""}`);
        if (readers.generated.length > 0) console.log(`- 生成物は生成器で作り直す: ${readers.generated.join(", ")}`);
      }
      if (problems.length === 0) problems.push(...(await checkTables(repoRoot, plan, path.join(tempDir, String(count)))));
      const ok = problems.length === 0;
      if (!ok) stopped++;
      console.log(`## ${domain.name} (${domain.dir}) ${ok ? "置ける" : "止めた"}: 書く ${Object.keys(plan.writes).length}・消す ${plan.removes.length}`);
      for (const line of problems) console.log(`- 止めた: ${line}`);
      if (ok && write) writePlacement(repoRoot, plan);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  console.log(`\n${count} ドメイン、止めた ${stopped}${write ? "(止めなかったドメインを書いた)" : "(計画だけ。--write で書く)"}`);
  process.exitCode = stopped > 0 ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
