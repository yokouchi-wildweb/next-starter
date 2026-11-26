// .notices/20261126-014453-domain-decl.place.mjs
// 置き場の道具: 宣言(entities/<登録名>/entity.json)を書いたドメインの表のファイルを、登録ごとのフォルダ entities/<登録名>/ の
// drizzle・schema・form・model へ移し、entities/<種類>.ts を登録のフォルダを集めるだけの入口にする(D335。import の道は変えない)。
// - 登録 1 つのドメイン: 4 ファイルをそのまま移し、中の相対の import を 1 段深く直す
// - 登録が複数: entities/ の 4 ファイルと表を持つ手のファイル(messaging の delivery.ts など)を、トップレベルの文ごとに登録へ付ける
//   (pgTable は表の名前、ほかは宣言の名前の頭の登録名・使う名前の付いた先)。種類は 4 ファイルならその名前、手のファイルは
//   表の物(pgTable・pgEnum・表を使う文)= drizzle、型 = model、zod = schema。付けられない文・登録をまたぐ export しない名前は止める
// 守り(書く前): 前後で出す名前の集まりが同じ・集める入口の名前がぶつからない・全部の表の事実が同じ・消す手のファイルを読む所が無い。
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
import { ENTITY_KINDS, renderEntityCollector } from "../scripts/structure/domain/render/entities/collector.mjs";
import { diffTableFacts, tableFactsOf } from "../scripts/structure/domain-tables/facts.mjs";
import { makeTempDir, resolveRepoImport } from "../scripts/structure/domain-tables/tables.mjs";

const COLLECTOR_NOTE = "を集めるだけの入口";
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

/** 相対の import の道を、ファイルが 1 段深く(entities/<登録名>/)へ移った時の道に */
const deeper = (specifier) => (specifier.startsWith("./") ? `../${specifier.slice(2)}` : specifier.startsWith("../") ? `../${specifier}` : specifier);

/** import の文の道を直す */
function rewriteImports(text, rewrite) {
  return text.replace(/(from\s+|import\s*\(\s*|import\s+)(["'])(\.{1,2}\/[^"']+)\2/g, (whole, head, quote, specifier) => `${head}${quote}${rewrite(specifier)}${quote}`);
}

/**
 * 1 つのドメインの置き場の計画(ファイルの中身だけから。書かない)
 * @param {{ domainRel: string, registrations: { name: string, table: string | null }[], files: Record<string, string> }} input files = entities/ 直下のファイル名 → 本文
 * @returns {{ writes: Record<string, string>, removes: string[], stops: string[], tables: string[] }} 道はリポジトリ相対
 */
export function planPlacement(input) {
  const { domainRel, registrations, files } = input;
  const entities = `${domainRel}/entities`;
  const result = { writes: {}, removes: [], stops: [], tables: [] };
  const kindFiles = ENTITY_KINDS.filter((kind) => files[`${kind}.ts`] !== undefined);
  if (kindFiles.some((kind) => files[`${kind}.ts`].includes(COLLECTOR_NOTE))) return result; // 置いた後(何度走らせても同じ)
  const candidates = Object.keys(files).filter((file) => file.endsWith(".ts") && !SKIP_FILES.has(file) && !/\.test\.tsx?$/.test(file));
  const topicFiles = candidates.filter((file) => !ENTITY_KINDS.includes(file.replace(/\.ts$/, "")) && /\bpgTable\s*\(/.test(files[file]));
  for (const file of [...kindFiles.map((kind) => `${kind}.ts`), ...topicFiles]) {
    for (const match of files[file].matchAll(/\bpgTable\s*\(\s*["'`]([^"'`]+)["'`]/g)) result.tables.push(match[1]);
  }

  if (registrations.length === 1) {
    if (topicFiles.length > 0) result.stops.push(`${entities}: 登録 1 つのドメインに表を持つ手のファイル ${topicFiles.join(", ")} がある(置き方を決める)`);
    const [registration] = registrations;
    for (const kind of kindFiles) {
      result.writes[`${entities}/${registration.name}/${kind}.ts`] = rewriteImports(files[`${kind}.ts`], (specifier) => {
        const target = specifier.replace(/^\.\//, "").replace(/\.ts$/, "");
        return specifier.startsWith("./") && kindFiles.includes(target) ? specifier : deeper(specifier);
      }).replace(/^\/\/ src\/domains\/[^\n]*\/entities\/[^\n]*\n/, `// ${entities}/${registration.name}/${kind}.ts\n`);
      result.writes[`${entities}/${kind}.ts`] = renderEntityCollector(domainRel, kind, [registration.name]);
    }
    return result;
  }

  // 登録が複数: 文ごとに登録と種類へ付ける
  const byTable = new Map(registrations.map((registration) => [registration.table, registration.name]));
  const pascals = registrations.map((registration) => [toPascalCase(registration.name), registration.name]).sort((a, b) => b[0].length - a[0].length);
  /** @type {{ file: string, statement: ts.Statement, text: string, names: string[], uses: Set<string>, kind: string | null, registration: string | null, exported: boolean, typeOnly: boolean }[]} */
  const items = [];
  /** @type {Map<string, { file: string, text: string, typeOnly: boolean, specifier: string, clause: string }>} */
  const imported = new Map();
  for (const file of [...kindFiles.map((kind) => `${kind}.ts`), ...topicFiles]) {
    const source = sourceOf(files[file], file);
    const fileKind = ENTITY_KINDS.includes(file.replace(/\.ts$/, "")) ? file.replace(/\.ts$/, "") : null;
    for (const statement of source.statements) {
      if (ts.isImportDeclaration(statement)) {
        const specifier = statement.moduleSpecifier.text;
        const clause = statement.importClause;
        const typeOnly = Boolean(clause?.isTypeOnly);
        for (const element of clause?.namedBindings && ts.isNamedImports(clause.namedBindings) ? clause.namedBindings.elements : []) {
          imported.set(element.name.text, { file, specifier, typeOnly: typeOnly || element.isTypeOnly, clause: element.propertyName ? `${element.propertyName.text} as ${element.name.text}` : element.name.text });
        }
        if (clause?.name) imported.set(clause.name.text, { file, specifier, typeOnly, clause: `default as ${clause.name.text}` });
        continue;
      }
      if (ts.isExportDeclaration(statement)) {
        // 手のファイルを集めていた export * from "./x" は、集める入口が代わる
        if (!statement.exportClause && statement.moduleSpecifier && topicFiles.includes(`${statement.moduleSpecifier.text.replace(/^\.\//, "")}.ts`)) continue;
        result.stops.push(`${entities}/${file}: export の文 "${statement.getText().slice(0, 60)}" を登録に付けられない`);
        continue;
      }
      const text = statement.getFullText(source).replace(/^\s*\n/, "").replace(/^\/\/ src\/domains\/[^\n]*\n(\/\/\n)?/, "");
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
      if (tableName && !registration) result.stops.push(`${entities}/${file}: 表 ${tableName} がどの登録(entity.json の table / plural)にも無い`);
      if (!registration) registration = names.map((name) => pascals.find(([pascal, reg]) => name.startsWith(pascal) || name.startsWith(reg))?.[1]).find(Boolean) ?? null;
      items.push({ file, statement, text, names, uses, kind, registration, exported: isExported(statement), typeOnly: isTypeOnly(statement) });
    }
  }
  // 名前で付かない文: 使う名前の付いた先、それも無ければ自分を使う文の付いた先
  const ownerOf = new Map();
  const settle = () => {
    for (const item of items) for (const name of item.names) if (item.registration) ownerOf.set(name, item);
  };
  for (let round = 0; round < 3; round++) {
    settle();
    for (const item of items.filter((candidate) => !candidate.registration)) {
      const used = [...item.uses].map((name) => ownerOf.get(name)).find((owner) => owner?.registration);
      const user = items.find((other) => other.registration && item.names.some((name) => other.uses.has(name)));
      item.registration = used?.registration ?? user?.registration ?? null;
      if (!item.kind && used) item.kind = used.kind;
    }
  }
  settle();
  for (const item of items) {
    if (!item.registration || !item.kind) {
      result.stops.push(`${entities}/${item.file}: 文 "${item.statement.getText().split("\n")[0].slice(0, 70)}" を登録・種類に付けられない`);
    }
  }
  if (result.stops.length > 0) return result;

  // 登録ごと・種類ごとのファイルを組む
  /** @type {Map<string, typeof items>} */
  const groups = new Map();
  for (const item of items) {
    const key = `${item.registration}/${item.kind}`;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  for (const [key, group] of groups) {
    const [registration, kind] = key.split("/");
    const needs = new Map();
    for (const item of group) {
      for (const name of item.uses) {
        const owner = ownerOf.get(name);
        if (owner && `${owner.registration}/${owner.kind}` !== key) {
          if (!owner.exported) {
            result.stops.push(`${entities}: ${name} は export されずに ${owner.registration}/${owner.kind} と ${key} の両方で使われる`);
            continue;
          }
          const specifier = owner.registration === registration ? `./${owner.kind}` : `../${owner.registration}/${owner.kind}`;
          needs.set(name, { specifier, typeOnly: owner.typeOnly, clause: name });
        } else if (!owner && imported.has(name)) {
          const from = imported.get(name);
          const target = from.specifier.replace(/^\.\//, "");
          if (from.specifier.startsWith("./") && (ENTITY_KINDS.includes(target) || topicFiles.includes(`${target}.ts`))) {
            // 同じ entities の物: 付いた先が無ければ集める入口から(手のファイルの名前は上で付いている)
            needs.set(name, { specifier: `../${ENTITY_KINDS.includes(target) ? target : "drizzle"}`, typeOnly: from.typeOnly, clause: from.clause });
          } else needs.set(name, { specifier: deeper(from.specifier), typeOnly: from.typeOnly, clause: from.clause });
        }
      }
    }
    const bySpecifier = new Map();
    for (const need of needs.values()) {
      const entry = bySpecifier.get(need.specifier) ?? { values: [], types: [] };
      (need.typeOnly ? entry.types : entry.values).push(need.clause);
      bySpecifier.set(need.specifier, entry);
    }
    const importLines = [...bySpecifier]
      .sort(([a], [b]) => a.localeCompare(b))
      .flatMap(([specifier, { values, types }]) => [
        ...(values.length > 0 ? [`import { ${[...new Set(values)].sort().join(", ")} } from "${specifier}";`] : []),
        ...(types.length > 0 ? [`import type { ${[...new Set(types)].sort().join(", ")} } from "${specifier}";`] : []),
      ]);
    const rel = `${entities}/${registration}/${kind}.ts`;
    result.writes[rel] = [`// ${rel}`, "", ...importLines, "", ...group.map((item) => item.text.trimEnd()), ""].join("\n").replace(/\n{3,}/g, "\n\n");
  }
  for (const kind of ENTITY_KINDS) {
    const regs = registrations.map((registration) => registration.name).filter((name) => groups.has(`${name}/${kind}`));
    if (regs.length > 0 || kindFiles.includes(kind)) result.writes[`${entities}/${kind}.ts`] = renderEntityCollector(domainRel, kind, regs);
  }
  for (const file of topicFiles) result.removes.push(`${entities}/${file}`);
  return result;
}

/**
 * 守り: 前後で出す名前の集まりが同じ・集める入口の名前がぶつからない(ファイルの中身だけから)
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
  const lost = [...before].filter((name) => !after.has(name)).sort();
  const added = [...after].filter((name) => !before.has(name)).sort();
  if (lost.length > 0) problems.push(`${entities}: 出していた名前が無くなる: ${lost.join(", ")}`);
  if (added.length > 0) problems.push(`${entities}: 出す名前が増える: ${added.join(", ")}`);
  return problems;
}

/** 守り: 消す手のファイルをリポジトリの中で読む所(git grep) */
function readersOfRemoved(repoRoot, removes) {
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

/** 守り: 置いた後の木(一時フォルダ)の表の事実が、今の表と同じか */
async function checkTables(repoRoot, plan, tempDir) {
  const changed = new Set([...Object.keys(plan.writes), ...plan.removes]);
  const tempOf = (rel) => path.join(tempDir, rel);
  const resolveFor = (rel, specifier) => {
    if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return import.meta.resolve(specifier);
    const fromAbs = path.join(repoRoot, rel);
    const base = specifier.startsWith(".") ? path.resolve(path.dirname(fromAbs), specifier) : null;
    if (base) {
      const candidate = [`${base}.ts`, path.join(base, "index.ts")].map((file) => path.relative(repoRoot, file).split(path.sep).join("/")).find((file) => changed.has(file) && plan.writes[file] !== undefined);
      if (candidate) return pathToFileURL(tempOf(candidate)).href;
    }
    const real = resolveRepoImport(repoRoot, specifier, fromAbs);
    if (!real) throw new Error(`${rel}: import "${specifier}" のファイルが見つからない`);
    const realRel = path.relative(repoRoot, real).split(path.sep).join("/");
    return pathToFileURL(plan.writes[realRel] !== undefined ? tempOf(realRel) : real).href;
  };
  for (const [rel, text] of Object.entries(plan.writes)) {
    const target = tempOf(rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, text.replace(/(from\s+|import\s*\(\s*)(["'])([^"']+)\2/g, (whole, head, quote, specifier) => `${head}${quote}${resolveFor(rel, specifier)}${quote}`));
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
      const entitiesDir = path.join(repoRoot, domain.dir, "entities");
      const files = Object.fromEntries(fs.readdirSync(entitiesDir, { withFileTypes: true }).filter((e) => e.isFile()).map((e) => [e.name, fs.readFileSync(path.join(entitiesDir, e.name), "utf8")]));
      const input = {
        domainRel: domain.dir,
        registrations: neon.map((r) => ({ name: r.name, table: typeof r.entity.table === "string" ? r.entity.table : toSnakeCase(typeof r.entity.plural === "string" ? r.entity.plural : r.name) })),
        files,
      };
      const plan = planPlacement(input);
      if (Object.keys(plan.writes).length === 0 && plan.stops.length === 0) {
        console.log(`## ${domain.name}: 置いてある(何もしない)`);
        continue;
      }
      const problems = [...plan.stops];
      if (problems.length === 0) problems.push(...checkExports(input, plan), ...readersOfRemoved(repoRoot, plan.removes));
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
