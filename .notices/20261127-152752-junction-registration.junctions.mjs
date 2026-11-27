// .notices/20261127-152752-junction-registration.junctions.mjs
// 起こす道具(区切り junction-registration、D354、一度きり: fork が走らせた後に上流が消す): 多対多(belongsToMany)の中間の表を、
// 今動いている表から結びの登録 entities/<結びの登録名>/entity.json として起こし、関係を through で名指す形に書き換える。
// - 持つ側: includeRelationTable:false でない側(今の表を作っていた側)。両側とも false なら、今ある結びの登録(両側の表を指す 2 本を持つ登録)の
//   ドメインの側。今ある結びの登録はそのまま使う(手の表の形の columns / foreignKeys / primaryKey のまま)
// - 起こす時: 今の表(地区の地図の表のファイルから読む <Owner>To<Target>Table)から宣言の道具の declareTable で、表・列(今の TS の名前)・
//   主キー・FK の名前と onDelete・索引を今のまま書き、宣言から組んだ表と照らして差 0 の物だけを書く(DB は変わらない)。
//   registered:false、generate は持つ側の登録の generate(生成する登録なら pnpm forge が結びのフォルダに書き、持つ側の表のファイルから外す)。
//   手で持つ側(generate:false)なら、その表の文を持つ側の表のファイルから entities/<結びの登録名>/drizzle.ts へ import ごと移す
// - 関係: 持つ側に through: <結びの登録名>、反対側は何も書かない(読むだけの参照)。includeRelationTable は全ての関係から外す
// - 止める(何も書かない): 今の表が無い・照らしの差がある、両側とも持つ側、どちらも持たず結びの登録も無い、持つ側の関係が無い、
//   起こす登録名が既にある、移す文の読み手が持つ側のファイルから直に読む
//
// 使い方(リポのルートで、.ts を読むので tsx の上): npx tsx --import ./scripts/runner/preload/serverOnly.mjs .notices/20261127-152752-junction-registration.junctions.mjs [--write]
//   既定 = 計画だけ。--write = 書く。続けて pnpm forge(結びのフォルダ・集める入口・表示の写し・base を作り直す)
//   何度走らせても同じ結果(through のある関係は計画に出ない)

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { getTableColumns, is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import ts from "typescript";

import { readDistrictMapAt } from "../src/lib/districtMap/node.mjs";
import { toCamelCase, toPascalCase, toSnakeCase } from "../src/lib/stringCase/index.mjs";
import { makeTempDir } from "../scripts/structure/domain-tables/tables.mjs";
import { declareTable } from "./20261126-014453-domain-decl.declare.mjs";

const DOMAIN_ROOTS = ["src/domains", "src/domains/core"];
const READER_ROOTS = ["src", "scripts", "tests"];
const CODE_FILE = /\.(ts|tsx|mts|mjs)$/;

const readJson = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const toPosix = (file) => file.split(path.sep).join("/");

/** 全ドメインの登録: 登録名 → { name, domain, domainDir, file, entity }(entity.json のそのまま) */
export function scanRegistrations(root) {
  const registrations = new Map();
  for (const base of DOMAIN_ROOTS) {
    const dir = path.join(root, base);
    if (!fs.existsSync(dir)) continue;
    for (const domain of fs.readdirSync(dir).sort()) {
      if (domain === "core" || domain.startsWith("_")) continue;
      const entities = path.join(dir, domain, "entities");
      if (!fs.existsSync(entities) || !fs.statSync(entities).isDirectory()) continue;
      for (const name of fs.readdirSync(entities).sort()) {
        const file = path.join(entities, name, "entity.json");
        if (!fs.existsSync(file)) continue;
        registrations.set(name, { name, domain, domainDir: `${base}/${domain}`, file: toPosix(path.relative(root, file)), entity: readJson(file) });
      }
    }
  }
  return registrations;
}

/** 登録の物理の表の名前(entity.json の table か snake(plural)) */
const tableOf = (registration) => (typeof registration.entity.table === "string" ? registration.entity.table : toSnakeCase(registration.entity.plural || registration.name));

/** 登録が指す登録名(belongsTo の domain、手の表の形の 1 列の foreignKeys の references.table) */
function linksOf(registration, registrationOfTable) {
  const links = [];
  for (const relation of registration.entity.relations ?? []) {
    if (relation?.relationType === "belongsTo") links.push(toCamelCase(relation.domain ?? ""));
  }
  for (const foreignKey of registration.entity.foreignKeys ?? []) {
    if ((foreignKey?.columns ?? []).length === 1) links.push(registrationOfTable.get(foreignKey.references?.table) ?? null);
  }
  return links;
}

/** 今ある結びの登録: a と b(同じなら 2 本とも a)を指す 2 本だけを持つ登録 */
function existingJunctionsOf(registrations, registrationOfTable, a, b) {
  const want = [a, b].sort().join(",");
  return [...registrations.values()].filter((registration) => {
    const links = linksOf(registration, registrationOfTable);
    return links.length === 2 && links.every(Boolean) && [...links].sort().join(",") === want;
  });
}

/** 今の表の読み込み(地区の地図の表のファイルから物理名で)→ { table, exportName, file } | null */
export function districtTableLoader(repoRoot) {
  const tableFiles = readDistrictMapAt(repoRoot).tableFiles;
  return async (name) => {
    const found = tableFiles.find((table) => table.name === name);
    if (!found) return null;
    const exports = await import(pathToFileURL(path.join(repoRoot, found.file)).href);
    const entry = Object.entries(exports).find(([, value]) => is(value, PgTable) && getTableConfig(value).name === name);
    return entry ? { exportName: entry[0], table: entry[1], file: found.file } : null;
  };
}

/** 関係の書き換え: includeRelationTable を外し、through を書くなら includeRelationTable の場所(無ければ relationType の後)に */
function rewriteRelation(relation, through) {
  const next = {};
  let placed = through === undefined;
  for (const [key, value] of Object.entries(relation)) {
    if (key === "includeRelationTable") {
      if (!placed) next.through = through;
      placed = true;
      continue;
    }
    next[key] = value;
    if (key === "relationType" && !placed && !Object.hasOwn(relation, "includeRelationTable")) {
      next.through = through;
      placed = true;
    }
  }
  if (!placed) next.through = through;
  return next;
}

/** 指定子(相対)を from のファイルから to のファイルの相対に付け替える。相対でなければそのまま */
function respecify(specifier, fromFile, toFile) {
  if (!specifier.startsWith(".")) return specifier;
  const target = path.posix.normalize(path.posix.join(path.posix.dirname(fromFile), specifier));
  const relative = path.posix.relative(path.posix.dirname(toFile), target);
  return relative.startsWith(".") ? relative : `./${relative}`;
}

/** ファイルの import: 名前 → { specifier, typeOnly, clause } */
function importsOf(source) {
  const imported = new Map();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const specifier = statement.moduleSpecifier.text;
    const clause = statement.importClause;
    const bindings = clause?.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        imported.set(element.name.text, { specifier, typeOnly: Boolean(clause.isTypeOnly || element.isTypeOnly), clause: element.propertyName ? `${element.propertyName.text} as ${element.name.text}` : element.name.text });
      }
    }
    if (bindings && ts.isNamespaceImport(bindings)) imported.set(bindings.name.text, { specifier, typeOnly: Boolean(clause.isTypeOnly), clause: `* as ${bindings.name.text}`, namespace: true });
    if (clause?.name) imported.set(clause.name.text, { specifier, typeOnly: Boolean(clause.isTypeOnly), clause: `default as ${clause.name.text}` });
  }
  return imported;
}

/** 文の中の識別子(プロパティの名前 x.<名前>・{ <名前>: … } は数えない) */
function identifiersIn(node) {
  const names = new Set();
  const visit = (child) => {
    const parent = child.parent;
    const propertyName = parent && ((ts.isPropertyAccessExpression(parent) && parent.name === child) || (ts.isPropertyAssignment(parent) && parent.name === child));
    if (ts.isIdentifier(child) && !propertyName) names.add(child.text);
    ts.forEachChild(child, visit);
  };
  visit(node);
  return names;
}

/** ファイルの頂の宣言の名前 */
function topLevelNames(source) {
  const names = new Set();
  for (const statement of source.statements) {
    if (ts.isVariableStatement(statement)) for (const declaration of statement.declarationList.declarations) if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text);
    if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isTypeAliasDeclaration(statement) || ts.isInterfaceDeclaration(statement) || ts.isEnumDeclaration(statement)) && statement.name) names.add(statement.name.text);
  }
  return names;
}

/** import の行(道ごとに値・型を分けてまとめる) */
function importLines(needs) {
  const bySpecifier = new Map();
  for (const need of needs) {
    if (need.namespace) {
      bySpecifier.set(`${need.specifier}\0${need.clause}`, { line: `import ${need.typeOnly ? "type " : ""}${need.clause} from "${need.specifier}";` });
      continue;
    }
    const entry = bySpecifier.get(need.specifier) ?? { values: new Set(), types: new Set() };
    (need.typeOnly ? entry.types : entry.values).add(need.clause);
    bySpecifier.set(need.specifier, entry);
  }
  return [...bySpecifier]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([specifier, entry]) => {
      if (entry.line) return [entry.line];
      const at = specifier.split("\0")[0];
      return [
        ...(entry.values.size > 0 ? [`import { ${[...entry.values].sort().join(", ")} } from "${at}";`] : []),
        ...(entry.types.size > 0 ? [`import type { ${[...entry.types].sort().join(", ")} } from "${at}";`] : []),
      ];
    });
}

/**
 * 表の文を持つ側のファイルから結びのファイルへ移す(書かない)
 * @returns {{ source: string, target: string } | { stop: string }}
 */
export function moveStatement(text, fromFile, toFile, exportName) {
  const source = ts.createSourceFile(fromFile, text, ts.ScriptTarget.Latest, true);
  const statement = source.statements.find((node) => ts.isVariableStatement(node) && node.declarationList.declarations.some((declaration) => ts.isIdentifier(declaration.name) && declaration.name.text === exportName));
  if (!statement) return { stop: `${fromFile} に ${exportName} の文が見つからない` };
  const imported = importsOf(source);
  const locals = topLevelNames(source);
  locals.delete(exportName);
  const used = identifiersIn(statement);
  used.delete(exportName);
  const needs = [];
  const fromLocal = [];
  for (const name of used) {
    const entry = imported.get(name);
    if (entry) needs.push({ ...entry, specifier: respecify(entry.specifier, fromFile, toFile) });
    else if (locals.has(name)) fromLocal.push(name);
  }
  if (fromLocal.length > 0) needs.push(...fromLocal.map((name) => ({ specifier: respecify(`./${path.posix.basename(fromFile).replace(/\.ts$/, "")}`, fromFile, toFile), typeOnly: false, clause: name })));
  const body = statement.getFullText(source).replace(/^\s*\n/, "");
  const target = `// ${toFile}\n\n${importLines(needs).join("\n")}\n\n${body.trimEnd()}\n`;
  // 残りのファイル: 文を外し、使われなくなった import の要素を外す
  const rest = text.slice(0, statement.getFullStart()) + text.slice(statement.getEnd());
  const restSource = ts.createSourceFile(fromFile, rest, ts.ScriptTarget.Latest, true);
  const stillUsed = new Set();
  for (const node of restSource.statements) if (!ts.isImportDeclaration(node)) for (const name of identifiersIn(node)) stillUsed.add(name);
  let pruned = rest;
  for (const node of [...restSource.statements].reverse()) {
    if (!ts.isImportDeclaration(node)) continue;
    const bindings = node.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings) || node.importClause.name) continue;
    const kept = bindings.elements.filter((element) => stillUsed.has(element.name.text));
    if (kept.length === bindings.elements.length) continue;
    const replacement = kept.length === 0 ? "" : `import ${node.importClause.isTypeOnly ? "type " : ""}{ ${kept.map((element) => element.getText(restSource)).join(", ")} } from "${node.moduleSpecifier.text}";`;
    const start = node.getStart(restSource);
    let end = node.getEnd();
    if (replacement === "" && pruned[end] === "\n") end += 1;
    pruned = pruned.slice(0, start) + replacement + pruned.slice(end);
  }
  return { source: `${pruned.replace(/\n{3,}/g, "\n\n").trimEnd()}\n`, target };
}

/** 移す表を持つ側のファイルから直に読む読み手(集める入口 entities/drizzle を通さない物) */
function directReaders(root, fromFile, exportName) {
  const found = [];
  const fromNoExt = fromFile.replace(/\.ts$/, "");
  const walk = (dir) => {
    for (const entry of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
      const rel = `${dir}/${entry.name}`;
      if (entry.isDirectory()) {
        if (entry.name !== "node_modules" && !entry.name.startsWith(".")) walk(rel);
        continue;
      }
      if (!CODE_FILE.test(entry.name) || rel === fromFile) continue;
      const text = fs.readFileSync(path.join(root, rel), "utf8");
      if (!text.includes(exportName)) continue;
      for (const match of text.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*["']([^"']+)["']/g)) {
        if (!new RegExp(`\\b${exportName}\\b`).test(match[1])) continue;
        const specifier = match[2];
        const resolved = specifier.startsWith(".") ? path.posix.normalize(path.posix.join(path.posix.dirname(rel), specifier)) : specifier.startsWith("@/") ? `src/${specifier.slice(2)}` : null;
        if (resolved === fromNoExt || resolved === fromFile) found.push(rel);
      }
    }
  };
  for (const dir of READER_ROOTS) if (fs.existsSync(path.join(root, dir))) walk(dir);
  return found;
}

/**
 * 計画(書かない)
 * @param {{ root: string, repoRoot?: string, loadTable?: (name: string) => Promise<{ table: PgTable, exportName: string, file: string } | null>, tempDir?: string }} input
 *   root = 読み書きするリポジトリ、repoRoot = 宣言から表を組む生成器のリポジトリ(既定 root)
 * @returns {Promise<{ lines: string[], stops: string[], writes: Record<string, string> }>} writes = リポジトリ相対の道 → 中身
 */
export async function planJunctions(input) {
  const root = input.root;
  const repoRoot = input.repoRoot ?? root;
  const loadTable = input.loadTable ?? districtTableLoader(repoRoot);
  const tempDir = input.tempDir ?? makeTempDir();
  const registrations = scanRegistrations(root);
  const registrationOfTable = new Map([...registrations.values()].map((registration) => [tableOf(registration), registration.name]));
  const lines = [];
  const stops = [];
  const writes = {};
  const relationsOf = new Map(); // 登録名 → 書き換えた relations
  const relationsNow = (name) => relationsOf.get(name) ?? registrations.get(name).entity.relations;
  const setRelation = (name, index, relation) => {
    const next = [...relationsNow(name)];
    next[index] = relation;
    relationsOf.set(name, next);
  };

  // 組(登録の 2 つ)ごとの多対多の関係
  const pairs = new Map();
  for (const registration of registrations.values()) {
    (registration.entity.relations ?? []).forEach((relation, index) => {
      if (relation?.relationType !== "belongsToMany") return;
      const target = toCamelCase(relation.domain ?? "");
      const key = [registration.name, target].sort().join(" ↔ ");
      const pair = pairs.get(key) ?? { key, sides: [] };
      pair.sides.push({ owner: registration.name, target, index, relation });
      pairs.set(key, pair);
    });
  }

  for (const pair of [...pairs.values()].sort((a, b) => a.key.localeCompare(b.key))) {
    const at = (side) => `${side.owner}.relations[${side.index}] → ${side.target}`;
    const throughSides = pair.sides.filter((side) => side.relation.through !== undefined);
    const stripReverse = (side) => {
      if (!Object.hasOwn(side.relation, "includeRelationTable")) return;
      setRelation(side.owner, side.index, rewriteRelation(side.relation, undefined));
      lines.push(`${at(side)}: 反対側(読むだけの参照)。includeRelationTable を外す`);
    };
    if (throughSides.length > 0) {
      // 書き換え済み(何度走らせても同じ)。残った includeRelationTable だけ外す
      for (const side of pair.sides) if (Object.hasOwn(side.relation, "includeRelationTable")) setRelation(side.owner, side.index, rewriteRelation(side.relation, side.relation.through));
      continue;
    }
    const [a, b] = pair.key.split(" ↔ ");
    if (!registrations.has(a) || !registrations.has(b)) {
      stops.push(`${pair.key}: 関係の相手の登録が無い(${[a, b].filter((name) => !registrations.has(name)).join(", ")})`);
      continue;
    }
    const existing = existingJunctionsOf(registrations, registrationOfTable, a, b);
    const owning = pair.sides.filter((side) => side.relation.includeRelationTable !== false);
    let owner;
    let junction;
    if (existing.length > 1) {
      stops.push(`${pair.key}: 両側の表を指す登録が 2 つ以上ある(${existing.map((registration) => registration.name).join(", ")})。どれが結びか決められない`);
      continue;
    }
    if (existing.length === 1) {
      junction = existing[0];
      const inDomain = pair.sides.filter((side) => registrations.get(side.owner).domain === junction.domain);
      const candidates = inDomain.length > 1 ? inDomain.filter((side) => side.relation.includeRelationTable !== false) : inDomain;
      if (candidates.length !== 1) {
        stops.push(`${pair.key}: 今ある結びの登録 ${junction.name}(${junction.domain})のドメインの側の関係が ${candidates.length === 0 ? "無い" : "2 つある"}(持つ側を決められない)`);
        continue;
      }
      owner = candidates[0];
      lines.push(`${at(owner)}: 持つ側。今ある結びの登録 ${junction.name}(${junction.file})をそのまま使う`);
    } else {
      if (owning.length === 0) {
        stops.push(`${pair.key}: どちらの関係も includeRelationTable:false で、両側の表を指す結びの登録も無い(中間の表がどこにも無い)`);
        continue;
      }
      if (owning.length > 1) {
        stops.push(`${pair.key}: 両側とも中間の表を持つ側になっている(${owning.map(at).join(" / ")})。片方を includeRelationTable:false にしてから走らせる`);
        continue;
      }
      owner = owning[0];
      const ownerRegistration = registrations.get(owner.owner);
      const singular = typeof ownerRegistration.entity.singular === "string" ? ownerRegistration.entity.singular : owner.owner;
      const tableName = toSnakeCase(`${toPascalCase(singular)}To${toPascalCase(owner.relation.domain)}`);
      const name = toCamelCase(tableName);
      if (registrations.has(name)) {
        stops.push(`${at(owner)}: 起こす結びの登録名 ${name} が既にある(${registrations.get(name).file})が、両側の表を指す 2 本を持たない`);
        continue;
      }
      const loaded = await loadTable(tableName);
      if (!loaded) {
        stops.push(`${at(owner)}: 今の中間の表 ${tableName} が見つからない(地区の地図の表のファイル)`);
        continue;
      }
      const generate = ownerRegistration.entity.generate !== false;
      // 主キーは今の表の合成の主キー(id の列を作らせない。列は declareTable が今の TS の名前で表だけの列に足す)
      const config = getTableConfig(loaded.table);
      const propOf = new Map(Object.entries(getTableColumns(loaded.table)).map(([prop, column]) => [column.name, prop]));
      const [primary] = config.primaryKeys;
      if (config.primaryKeys.length !== 1 || primary.columns.length !== 2) {
        stops.push(`${at(owner)}: 今の中間の表 ${tableName} が 2 列の合成の主キーを持たない`);
        continue;
      }
      // 生成する登録の決まりの鍵(pnpm check domain): 名前・表示名・id の型(合成の主キーなので id の列は作らない)・時刻の列なし
      const target = registrations.get(owner.target);
      const generatedKeys = generate
        ? { label: `${ownerRegistration.entity.label ?? owner.owner}と${target.entity.label ?? owner.target}`, singular: tableName, idType: "uuid", useCreatedAt: false, useUpdatedAt: false }
        : {};
      const base = {
        ...generatedKeys,
        plural: tableName,
        dbEngine: ownerRegistration.entity.dbEngine ?? "Neon",
        ...(generate ? {} : { generate: false }),
        registered: false,
        primaryKey: { columns: primary.columns.map((column) => propOf.get(column.name)), name: primary.getName() },
        fields: [],
      };
      const dir = `${ownerRegistration.domainDir}/entities/${name}`;
      const declared = await declareTable({ repoRoot, registration: name, domain: ownerRegistration.domain, domainDir: ownerRegistration.domainDir, tableFile: loaded.file, actual: loaded.table, base, fromOld: false, tempDir });
      if (!declared.entity) {
        stops.push(...declared.stops.map((line) => `${at(owner)}: ${line}`));
        continue;
      }
      writes[`${dir}/entity.json`] = `${JSON.stringify(declared.entity, null, 2)}\n`;
      lines.push(`${at(owner)}: 持つ側。結びの登録 ${name} を今の表 ${tableName} から起こす(${dir}/entity.json、照らしの差 0、generate ${generate})`);
      if (!generate) {
        const fromFile = loaded.file;
        const toFile = `${dir}/drizzle.ts`;
        if (!fromFile.startsWith(`${ownerRegistration.domainDir}/entities/`)) {
          stops.push(`${at(owner)}: 今の表 ${tableName} のファイル ${fromFile} が持つ側のドメインの entities/ に無い`);
          continue;
        }
        const readers = directReaders(root, fromFile, loaded.exportName);
        if (readers.length > 0) {
          stops.push(`${at(owner)}: ${loaded.exportName} を ${fromFile} から直に読む読み手がある(${readers.join(", ")})。集める入口 entities/drizzle から読むように直してから走らせる`);
          continue;
        }
        // 同じ持つ側のファイルに結びが 2 本以上ある時は、前の結びで書き換えた後の中身から移す(元のファイルから読み直すと、
        // 後の結びの書き換えが前の結びの書き換えを上書きし、前の表の文が残って新しい結びのファイルと二重の export になる)
        const current = writes[fromFile] ?? fs.readFileSync(path.join(root, fromFile), "utf8");
        const moved = moveStatement(current, fromFile, toFile, loaded.exportName);
        if (moved.stop) {
          stops.push(`${at(owner)}: ${moved.stop}`);
          continue;
        }
        writes[fromFile] = moved.source;
        writes[toFile] = moved.target;
        lines.push(`${at(owner)}: 表の文 ${loaded.exportName} を移す ${fromFile} → ${toFile}`);
      }
      junction = { name };
    }
    setRelation(owner.owner, owner.index, rewriteRelation(owner.relation, junction.name));
    lines.push(`${at(owner)}: through: ${junction.name} を書き、includeRelationTable を外す`);
    for (const side of pair.sides) if (side !== owner) stripReverse(side);
  }

  for (const [name, relations] of relationsOf) {
    const registration = registrations.get(name);
    writes[registration.file] = `${JSON.stringify({ ...registration.entity, relations }, null, 2)}\n`;
  }
  return { lines, stops, writes };
}

/** 計画を書く */
export function writePlan(root, plan) {
  for (const [file, content] of Object.entries(plan.writes)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }
}

async function main() {
  const root = process.cwd();
  const write = process.argv.includes("--write");
  const tempDir = makeTempDir();
  try {
    const plan = await planJunctions({ root, tempDir });
    for (const line of plan.lines) console.log(line);
    if (plan.stops.length > 0) {
      for (const line of plan.stops) console.error(`止める: ${line}`);
      console.error("何も書いていません");
      process.exitCode = 1;
      return;
    }
    if (plan.lines.length === 0) {
      console.log("書き換える関係はありません(済み)");
      return;
    }
    if (!write) {
      console.log(`計画だけ(書くファイル ${Object.keys(plan.writes).length})。--write で書く`);
      return;
    }
    writePlan(root, plan);
    console.log(`書いた: ${Object.keys(plan.writes).sort().join(", ")}`);
    console.log("続けて: pnpm forge");
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
