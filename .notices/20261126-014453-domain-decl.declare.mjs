// .notices/20261126-014453-domain-decl.declare.mjs
// 起こす道具(宣言): 今のファイル(1 ファイルの domain.json・手書きの services/server/domainEntry.ts・今の表の定義)から、ドメインごとに
// 短い domain.json と、登録(表 1 つ)ごとの entities/<登録名>/entity.json を組む(形は src/lib/domain/README.md「宣言の形」)。
// 推測で書かない: 表の形は今の表から読み、宣言から生成器で組んだ表との違いを埋め、照らしの差 0・登録表の値・表示の写し・管理一覧の値が
// 前後で同じになった物だけを書く。崩れたドメインは書かずに止め、違いを出す。宣言と動いている値の食い違いは「動いている値で書いた」行に出す。
//
// 使い方(リポのルートで、.ts を読むので tsx の上): npx tsx .notices/20261126-014453-domain-decl.declare.mjs [--write] [--domain=<名前>] [--labels=<file>] [--with-place]
//   既定 = 計画だけ(何も書かない)。--write = 止めなかったドメインの domain.json(短い形に書き換え)と entity.json を書く。
//   --labels = { "<ドメイン>": "<表示名>" } の JSON(1 ファイルの domain.json の無いドメインの label。無いドメインは止める)
//   --with-place = 計画だけの時、計画した登録で置き場の道具(place)の分け方と名前の守りも見る(書かない。表の読み込みの守りは place 自身)
//   今の domainEntry.ts・表の定義は消さない(読み手の付け替えの後に消す)。何度走らせても同じ結果(短い形の domain.json は読み直して使う)

import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { pathToFileURL } from "node:url";

import { getTableColumns, is, SQL } from "drizzle-orm";
import { getTableConfig, PgDialect, PgTable } from "drizzle-orm/pg-core";

import { DOMAIN_DECLARATION_VERSION } from "../src/lib/domain/node.mjs";
import { readDistrictMapAt } from "../src/lib/districtMap/node.mjs";
import { toCamelCase, toSnakeCase } from "../src/lib/stringCase/index.mjs";
import { domainTableName } from "../scripts/structure/domain/domain/names.mjs";
import { buildDomainEntryAccess } from "../scripts/structure/domain/render/registry/domainEntry.mjs";
import { toDomainDisplay } from "../scripts/structure/registry/alpha/domainDisplay.mjs";
import { diffTableFacts, tableFactsOf } from "../scripts/structure/domain-tables/facts.mjs";
import { makeTempDir, renderExpected, resolveRepoImport } from "../scripts/structure/domain-tables/tables.mjs";
import { checkExports, placementInput, planPlacement, readersOfRemoved } from "./20261126-014453-domain-decl.place.mjs";

const dialect = new PgDialect();
const ADMIN_RULE = { roleCategories: ["admin"] };

/** SQL の式 → 文字列 */
function sqlText(value) {
  const query = dialect.sqlToQuery(value);
  return query.params.reduce((text, param, index) => text.replace(`$${index + 1}`, JSON.stringify(param)), query.sql);
}

/**
 * 宣言の登録の access(登録表に載る値): 手で持つ登録(generate:false)は apiAccess をそのまま(動いている値を全部書く)。
 * 生成する登録は apiAccess の read / write と、operations の既定(truncateAll は管理者、export / import は useImportExport)に
 * apiAccess.operations の書いた鍵を重ねる(今の生成器の buildDomainEntryAccess とは重ねる順だけが違う。生成のドメインは
 * truncateAll・export・import を書かないので同じ値)。宣言から作る登録表(区切りの最後の指令)がこの規則を使う
 */
export function accessOfDeclaration(entity) {
  // 手で持つ登録(generate:false)は apiAccess をそのまま登録する(書かなければ生成と同じ fail-closed の既定)
  if (entity.generate === false && entity.apiAccess) return structuredClone(entity.apiAccess);
  const generated = buildDomainEntryAccess(entity);
  const written = entity.apiAccess?.operations ?? {};
  return { ...generated, operations: { ...generated.operations, ...written } };
}

/** 登録表の値の比べる形 */
const registryRow = (key, row) => ({ key, table: row.table ?? null, idColumn: row.idColumn ?? null, access: row.access, requires: row.requires ?? [] });

/** domainEntry.ts の字面から service の file・export(既定 <key>Service と同じなら null) */
function serviceOf(text, key) {
  const match = new RegExp(`\\b${key}:\\s*\\{\\s*service:\\s*\\(\\)\\s*=>\\s*import\\("\\./([^"]+)"\\)\\.then\\(\\(m\\)\\s*=>\\s*m\\.(\\w+)\\)`).exec(text);
  if (!match) return { service: undefined, problem: `domainEntry.ts の ${key} の service の字面が読めない` };
  if (match[1] === `${key}Service` && match[2] === `${key}Service`) return { service: null, problem: null };
  return { service: { file: match[1], export: match[2] }, problem: null };
}

/** domainEntry.ts の key の直前の注記(// の行)= 登録の理由 */
function reasonOf(text, key) {
  const lines = text.split("\n");
  const at = lines.findIndex((line) => new RegExp(`^\\s*${key}:\\s*\\{`).test(line));
  const notes = [];
  for (let index = at - 1; index >= 0 && /^\s*\/\//.test(lines[index]); index--) notes.unshift(lines[index].replace(/^\s*\/\/\s?/, ""));
  return notes.length > 0 ? notes.join(" ") : undefined;
}

/** 表の定義ファイルの pgEnum("<name>", X) の X が識別子なら、その import 元の valuesFrom */
function enumSourceOf(repoRoot, tableFile, enumName) {
  const text = fs.readFileSync(path.join(repoRoot, tableFile), "utf8");
  const call = new RegExp(`pgEnum\\(\\s*["']${enumName}["']\\s*,\\s*([A-Za-z_$][\\w$.]*)`).exec(text);
  if (!call) return null;
  const ident = call[1].split(".")[0];
  const imported = new RegExp(`import\\s*\\{[^}]*\\b${ident}\\b[^}]*\\}\\s*from\\s*["']([^"']+)["']`).exec(text);
  const resolveFile = (spec) => {
    const file = resolveRepoImport(repoRoot, spec, path.join(repoRoot, tableFile));
    return file ? path.relative(repoRoot, file).split(path.sep).join("/") : null;
  };
  if (imported) {
    const file = resolveFile(imported[1]);
    return file && call[1] === ident ? { file, export: ident } : { problem: `enum ${enumName} の値 ${call[1]} の出どころが読めない` };
  }
  if (new RegExp(`export\\s+const\\s+${ident}\\b`).test(text) && call[1] === ident) return { file: tableFile, export: ident };
  return { problem: `enum ${enumName} の値 ${call[1]} が export されていない(valuesFrom で名指せない)` };
}

/** 表の構造の要約(違いを埋めるための索引) */
function structureOf(table) {
  const config = getTableConfig(table);
  const props = Object.fromEntries(Object.entries(getTableColumns(table)).map(([prop, column]) => [column.name, prop]));
  return { config, props, columns: Object.fromEntries(config.columns.map((column) => [column.name, column])) };
}

/** 今の列 → 宣言の column(fieldType の既定と違う所だけを後で残す) */
function columnFacts(column) {
  const facts = { type: column.getSQLType(), notNull: column.notNull };
  // identity の列も hasDefault を持つ(default は無い)。関数の既定($defaultFn)と取り違えない
  if (column.hasDefault && !column.generatedIdentity) {
    if (column.default === undefined) return { ...facts, problem: `列 ${column.name} の既定が関数($defaultFn)で宣言に書けない` };
    facts.default = is(column.default, SQL) ? { sql: sqlText(column.default) } : column.default;
  }
  if (column.generatedIdentity) facts.identity = column.generatedIdentity.type;
  return facts;
}

/**
 * 1 つの表の宣言を、今の表に照らして違いを埋めて起こす
 * @param {{ repoRoot: string, registration: string, domain: string, domainDir: string, tableFile: string, actual: PgTable, base: object, fromOld: boolean, tempDir: string }} input
 * @returns {Promise<{ entity: object | null, discrepancies: string[], stops: string[], covered: string[] }>}
 */
export async function declareTable(input) {
  const { repoRoot, registration, actual, tempDir } = input;
  const entity = structuredClone(input.base);
  const discrepancies = [];
  const stops = [];
  const now = structureOf(actual);
  const tableName = now.config.name;
  const note = (text) => (input.fromOld ? discrepancies.push(`${tableName}: ${text}`) : undefined);
  entity.fields ??= [];

  for (let pass = 0; pass < 4; pass++) {
    // hiddenColumns は表の形を変えない(実行時の宣言)ので、項目が揃う前でも組めるよう外して組む
    const { hiddenColumns: _hidden, ...shape } = entity;
    const match = { domain: input.domain, registration, dir: `${input.domainDir}/entities/${registration}`, domainDir: input.domainDir, config: shape, table: tableName, problems: [] };
    let expected;
    let rendered;
    try {
      rendered = await renderExpected(repoRoot, match, tempDir);
      expected = rendered.table;
    } catch (error) {
      return { entity: null, discrepancies, stops: [`${tableName}: 宣言から表を組めない: ${error instanceof Error ? error.message : String(error)}`], covered: [] };
    }
    const lines = diffTableFacts(tableFactsOf(expected), tableFactsOf(actual));
    if (lines.length === 0) {
      if (entity.fields.length === 0) delete entity.fields;
      const covered = rendered.tables.map((table) => getTableConfig(table).name).filter((name) => name !== tableName);
      return { entity, discrepancies, stops, covered };
    }
    if (pass === 3) return { entity: null, discrepancies, stops: [...stops, ...lines], covered: [] };
    const want = structureOf(expected);
    let changed = false;
    // 項目(fields)と表だけの列(columns)は列の名前で引く(1 ファイルの宣言の項目名は snake のことがある = 今の表のプロパティ名と
    // 違う。宣言の名前を使い続ける)。1 つの列はどちらか一方にだけある
    const columnNameOf = (field) => field.column?.name ?? toSnakeCase(field.name);
    const fieldByColumn = (name) => [...entity.fields, ...(entity.columns ?? [])].find((field) => columnNameOf(field) === name);
    const nameFor = (columnName) => fieldByColumn(columnName)?.name ?? want.props[columnName] ?? now.props[columnName];

    // 列: 今だけの列は項目に足し、両方の列は違う所を column に書く
    for (const [name, column] of Object.entries(now.columns)) {
      const facts = columnFacts(column);
      if (facts.problem) return { entity: null, discrepancies, stops: [`${tableName}: ${facts.problem}`], covered: [] };
      const target = want.columns[name];
      let field = fieldByColumn(name);
      const prop = field?.name ?? now.props[name];
      if (!target) {
        if (field) return { entity: null, discrepancies, stops: [`${tableName}: 項目 ${prop} の列が宣言から組んだ表に無い(今 ${name})`], covered: [] };
        // 宣言に無かった列は表だけの列(columns)に足す: 画面・フォームの項目にしない(表示の写しを変えない、AMENDMENT 1)
        field = { name: prop, column: column.enum ? { enum: column.enum.enumName } : { type: facts.type } };
        if (toSnakeCase(prop) !== name) field.column.name = name;
        entity.columns ??= [];
        entity.columns.push(field);
        note(`列 ${name} を表だけの列 ${prop} として足した(宣言に無かった)`);
        changed = true;
      }
      if (!field) {
        // 生成器が別の鍵(関連・システム列・id)から作る列。関連の列のユニークは関連の unique(1 対 1)
        if (column.isUnique && !target.isUnique) {
          const relation = (entity.relations ?? []).find((rel) => rel.relationType === "belongsTo" && toSnakeCase(rel.fieldName) === name);
          if (relation) {
            relation.unique = true;
            note(`関連 ${relation.fieldName} の列のユニークを今の値で書いた(1 対 1、制約)`);
            changed = true;
            continue;
          }
        }
        const wantFacts = columnFacts(target);
        if (!isDeepStrictEqual({ ...wantFacts }, { ...facts })) {
          return { entity: null, discrepancies, stops: [`${tableName}: 列 ${name} は関連・システム列・id から作られ、今の形と違う: 宣言 ${JSON.stringify(wantFacts)} / 今 ${JSON.stringify(facts)}`], covered: [] };
        }
        continue;
      }
      // 足したばかりの列は生成器の既定(NULL 可・既定なし)と比べる(notNull:false のような既定どおりの鍵を書かない)
      const wantFacts = target ? columnFacts(target) : { notNull: false };
      field.column ??= {};
      if (column.enum) {
        const values = enumSourceOf(repoRoot, input.tableFile, column.enum.enumName);
        if (values?.problem) return { entity: null, discrepancies, stops: [`${tableName}: ${values.problem}`], covered: [] };
        entity.enums ??= [];
        if (!entity.enums.some((entry) => entry.name === column.enum.enumName)) {
          entity.enums.push(values ? { name: column.enum.enumName, valuesFrom: values } : { name: column.enum.enumName, values: [...column.enum.enumValues] });
        }
        if (field.column.enum !== column.enum.enumName && target?.enum?.enumName !== column.enum.enumName) {
          field.column.enum = column.enum.enumName;
          changed = true;
        }
      } else if (wantFacts.type !== facts.type) {
        field.column.type = facts.type;
        if (target) note(`項目 ${prop} の型を今の ${facts.type} で書いた(宣言 ${wantFacts.type})`);
        changed = true;
      }
      if (wantFacts.notNull !== facts.notNull) {
        field.column.notNull = facts.notNull;
        if (target) note(`項目 ${prop} の NOT NULL を今の ${facts.notNull} で書いた(制約)`);
        changed = true;
      }
      if (!isDeepStrictEqual(wantFacts.default, facts.default)) {
        if (facts.default === undefined) return { entity: null, discrepancies, stops: [`${tableName}: 項目 ${prop} の宣言の既定を今は持たない(既定を外す鍵が無い)`], covered: [] };
        delete field.defaultValue;
        field.column.default = facts.default;
        changed = true;
      }
      if (wantFacts.identity !== facts.identity) {
        field.column.identity = facts.identity;
        changed = true;
      }
      // 列のユニークは column.unique(項目の unique はソフトデリートの表で部分索引になるので、列の制約はこちらで書く)
      if (column.isUnique && !(target?.isUnique)) {
        field.column.unique = true;
        note(`${prop} の列のユニークを今の値で書いた(制約)`);
        changed = true;
      } else if (!column.isUnique && target?.isUnique) {
        if (field.column.unique) delete field.column.unique;
        else delete field.unique;
        note(`${prop} の列のユニークを外した(今は列の制約でない。索引のユニークは索引の行)(制約)`);
        changed = true;
      }
      if (Object.keys(field.column).length === 0) delete field.column;
    }
    for (const name of Object.keys(want.columns)) {
      if (!now.columns[name]) return { entity: null, discrepancies, stops: [`${tableName}: 宣言から組んだ表にだけ列 ${name} がある`], covered: [] };
    }

    // 主キー・FK・索引・check: 今だけの物を足す(宣言だけの物・形の違う物は止める)
    const propsOf = (columns) => columns.map((column) => nameFor(column.name));
    const wantPk = want.config.primaryKeys.map((pk) => pk.getName());
    for (const pk of now.config.primaryKeys) {
      if (wantPk.includes(pk.getName())) continue;
      entity.primaryKey = { columns: propsOf(pk.columns), name: pk.getName() };
      delete entity.idType;
      changed = true;
    }
    const wantFks = new Set(want.config.foreignKeys.map((fk) => fk.getName()));
    for (const fk of now.config.foreignKeys) {
      if (wantFks.has(fk.getName())) continue;
      const reference = fk.reference();
      entity.foreignKeys ??= [];
      entity.foreignKeys.push({
        columns: propsOf(reference.columns),
        references: { table: getTableConfig(reference.foreignTable).name, columns: reference.foreignColumns.map((column) => Object.entries(getTableColumns(reference.foreignTable)).find(([, c]) => c === column)?.[0] ?? column.name) },
        ...(fk.onDelete && fk.onDelete !== "no action" ? { onDelete: fk.onDelete.toUpperCase().replace(" ", "_") } : {}),
        ...(fk.onUpdate && fk.onUpdate !== "no action" ? { onUpdate: fk.onUpdate.toUpperCase().replace(" ", "_") } : {}),
        name: fk.getName(),
      });
      note(`FK ${fk.getName()} を今の値で書いた(制約)`);
      changed = true;
    }
    // 宣言に書いてあって今の表に無い索引は、動いている値を正として宣言から外す(制約の食い違いの行)
    const nowIndexes = new Set(now.config.indexes.map((index) => index.config.name));
    for (const index of want.config.indexes) {
      const at = (entity.indexes ?? []).findIndex((declared) => declared.name === index.config.name);
      if (nowIndexes.has(index.config.name) || at < 0) continue;
      entity.indexes.splice(at, 1);
      note(`索引 ${index.config.name} は今の表に無いので宣言から外した${index.config.unique ? "(制約)" : ""}`);
      changed = true;
    }
    const wantIndexes = new Set(want.config.indexes.map((index) => index.config.name));
    for (const index of now.config.indexes) {
      const c = index.config;
      if (wantIndexes.has(c.name)) continue;
      const declared = { name: c.name };
      if (c.columns.length === 1 && is(c.columns[0], SQL)) declared.expression = sqlText(c.columns[0]);
      else if (c.columns.every((part) => !is(part, SQL))) {
        declared.fields = c.columns.map((part) => nameFor(part.name));
        const desc = c.columns.filter((part) => part.indexConfig?.order === "desc").map((part) => nameFor(part.name));
        if (desc.length > 0) declared.desc = desc;
        const opclass = Object.fromEntries(c.columns.filter((part) => part.indexConfig?.opClass).map((part) => [nameFor(part.name), part.indexConfig.opClass]));
        if (Object.keys(opclass).length > 0) declared.opclass = opclass;
      } else return { entity: null, discrepancies, stops: [`${tableName}: 索引 ${c.name} は列と式が混ざり宣言に書けない`], covered: [] };
      if (c.unique) declared.unique = true;
      if (c.where) declared.where = sqlText(c.where);
      if (c.method && c.method !== "btree") declared.using = c.method;
      entity.indexes ??= [];
      entity.indexes.push(declared);
      note(`索引 ${c.name} を今の値で書いた${c.unique ? "(制約)" : ""}`);
      changed = true;
    }
    const wantChecks = new Set(want.config.checks.map((entry) => entry.name));
    for (const entry of now.config.checks) {
      if (wantChecks.has(entry.name)) continue;
      entity.checks ??= [];
      entity.checks.push({ name: entry.name, sql: sqlText(entry.value) });
      note(`check ${entry.name} を今の値で書いた(制約)`);
      changed = true;
    }
    if (!changed) return { entity: null, discrepancies, stops: [...stops, ...lines], covered: [] };
  }
  return { entity: null, discrepancies, stops, covered: [] };
}

/** 表の定義のファイルの中の物理名 name の表と export 名 */
async function loadTable(repoRoot, file, name) {
  const exports = await import(pathToFileURL(path.join(repoRoot, file)).href);
  const entry = Object.entries(exports).find(([, value]) => is(value, PgTable) && getTableConfig(value).name === name);
  return entry ? { exportName: entry[0], table: entry[1] } : null;
}

const readJson = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null);
const lowerFirst = (text) => text.charAt(0).toLowerCase() + text.slice(1);

/**
 * 1 つのドメインの計画
 * @returns {Promise<{ name: string, dir: string, domainJson: object | null, registrations: { name: string, entity: object }[], discrepancies: string[], stops: string[], notes: string[] }>}
 */
export async function planDomain(repoRoot, district, tableFiles, labels, tempDir, allOld) {
  const dir = district.dir;
  const result = { name: district.name, dir, domainJson: null, registrations: [], discrepancies: [], stops: [], notes: [] };
  const rawJson = readJson(path.join(repoRoot, dir, "domain.json"));
  const old = rawJson && rawJson.domainConfigVersion !== DOMAIN_DECLARATION_VERSION ? rawJson : null;
  const label = old?.label ?? (rawJson?.domainConfigVersion === DOMAIN_DECLARATION_VERSION ? rawJson.label : undefined) ?? labels[district.name];
  if (typeof label !== "string" || label.length === 0) result.stops.push(`${district.name}: ドメインの label が無い(--labels に書く)`);
  result.domainJson = { domainConfigVersion: DOMAIN_DECLARATION_VERSION, label };

  // 登録表の今の値(手書きか生成の domainEntry.ts を tsx で読む)
  const entryFile = path.join(repoRoot, dir, "services", "server", "domainEntry.ts");
  const entryText = fs.existsSync(entryFile) ? fs.readFileSync(entryFile, "utf8") : "";
  const entries = entryText ? (await import(pathToFileURL(entryFile).href)).domainEntries : {};
  const entryByTable = new Map(Object.entries(entries).map(([key, row]) => [row.table, { key, row }]));
  const before = Object.entries(entries).map(([key, row]) => registryRow(key, row));

  const tables = tableFiles.filter((table) => table.file.startsWith(`${dir}/`));
  const generatedByRole = (file) => /pnpm generate role/.test(fs.readFileSync(path.join(repoRoot, file), "utf8").split("\n").slice(0, 3).join("\n"));
  const mainTable = old ? domainTableName(district.name, old) : null;
  const covered = new Set();
  const after = [];
  // 主の表(1 ファイルの domain.json の表)を先に: その中間表を「作る表」として外す
  const ordered = [...tables].sort((a, b) => Number(b.name === mainTable) - Number(a.name === mainTable));
  for (const tableFile of ordered) {
    if (covered.has(tableFile.name)) continue;
    if (generatedByRole(tableFile.file)) {
      result.notes.push(`${tableFile.name}: pnpm generate role の表(役割のプロフィール)は起こさない`);
      continue;
    }
    const loaded = await loadTable(repoRoot, tableFile.file, tableFile.name);
    if (!loaded) {
      result.stops.push(`${tableFile.name}: ${tableFile.file} の表を読み込めない`);
      continue;
    }
    const entry = entryByTable.get(tableFile.name);
    const isMain = tableFile.name === mainTable;
    const registration = entry?.key ?? (isMain || tables.length === 1 ? district.name : lowerFirst(loaded.exportName.replace(/Table$/, "")));
    const fromOld = Boolean(isMain && old);
    const base = fromOld ? baseFromOld(old, tableFile.name) : { plural: tableFile.name, dbEngine: "Neon", fields: [] };
    if (!fromOld || old.generate === false || district.core) base.generate = false;
    if (!fromOld) Object.assign(base, systemFlagsOf(loaded.table), idTypeOf(loaded.table) ?? primaryKeyOf(loaded.table));
    if (entry) {
      Object.assign(base, registrationKeysOf(entry, entryText, base, result));
    } else {
      base.registered = false;
      result.notes.push(`${tableFile.name}: 登録表に無い表 → registered:false`);
    }
    const declared = await declareTable({ repoRoot, registration, domain: district.name, domainDir: dir, tableFile: tableFile.file, actual: loaded.table, base, fromOld, tempDir });
    result.discrepancies.push(...declared.discrepancies);
    if (!declared.entity) {
      result.stops.push(...declared.stops);
      continue;
    }
    for (const name of declared.covered) covered.add(name);
    result.registrations.push({ name: registration, entity: declared.entity });
    if (declared.entity.registered !== false) {
      after.push(registryRow(registration, { table: tableFile.name, idColumn: idColumnOf(declared.entity, loaded.table), access: accessOfDeclaration(declared.entity), requires: declared.entity.requires }));
    }
    if (fromOld) guardViews(old, declared.entity, allOld, result);
  }
  // Firestore の登録(表を持たない)は 1 ファイルの domain.json から写す
  if (old && old.dbEngine === "Firestore") {
    const entity = baseFromOld(old, null);
    if (old.generate === false || district.core) entity.generate = false;
    const entry = Object.entries(entries)[0];
    if (entry) Object.assign(entity, registrationKeysOf({ key: entry[0], row: entry[1] }, entryText, entity, result));
    result.registrations.push({ name: entry?.[0] ?? district.name, entity });
    if (entry) after.push(registryRow(entry[0], { table: null, idColumn: null, access: accessOfDeclaration(entity), requires: entity.requires }));
    guardViews(old, entity, allOld, result);
  }
  const sortRows = (rows) => [...rows].sort((a, b) => a.key.localeCompare(b.key));
  if (result.stops.length === 0 && !isDeepStrictEqual(sortRows(before), sortRows(after))) {
    result.stops.push(`${district.name}: 登録表の値が前後で違う: 前 ${JSON.stringify(sortRows(before))} / 後 ${JSON.stringify(sortRows(after))}`);
  }
  return result;
}

/** 1 ファイルの domain.json → 表の宣言の土台(compositeUniques は生成器と同じ名前の indexes unique に) */
function baseFromOld(old, tableName) {
  const { domainConfigVersion: _version, compositeUniques, ...rest } = old;
  const base = structuredClone(rest);
  if (tableName && Array.isArray(compositeUniques) && compositeUniques.length > 0) {
    base.indexes = [
      ...(base.indexes ?? []),
      ...compositeUniques.map((fields, index) => ({ fields, unique: true, name: `${tableName}_composite_unique_${index}`, ...(old.useSoftDelete ? { where: "deleted_at IS NULL" } : {}) })),
    ];
  }
  return base;
}

/** システム列が生成器の形(timestamp with time zone、created / updated は now() の既定)なら use* の旗 */
function systemFlagsOf(table) {
  const columns = Object.fromEntries(getTableConfig(table).columns.map((column) => [column.name, column]));
  const isSystem = (name, withDefault) => {
    const column = columns[name];
    return Boolean(column) && column.getSQLType() === "timestamp with time zone" && !column.notNull && (withDefault ? column.hasDefault && is(column.default, SQL) && sqlText(column.default) === "now()" : !column.hasDefault);
  };
  return {
    ...(isSystem("created_at", true) && getTableColumns(table).createdAt ? { useCreatedAt: true } : {}),
    ...(isSystem("updated_at", true) && getTableColumns(table).updatedAt ? { useUpdatedAt: true } : {}),
    ...(isSystem("deleted_at", false) && getTableColumns(table).deletedAt ? { useSoftDelete: true } : {}),
  };
}

/** id 列が生成器の形(uuid defaultRandom / text / integer の主キー)なら idType、違えば null */
function idTypeOf(table) {
  const id = getTableColumns(table).id;
  if (!id || !id.primary || id.name !== "id") return null;
  const type = id.getSQLType();
  if (type === "uuid" && id.hasDefault && is(id.default, SQL) && sqlText(id.default) === "gen_random_uuid()") return { idType: "uuid" };
  if (type === "text" && !id.hasDefault) return { idType: "string" };
  if (type === "integer" && !id.hasDefault) return { idType: "number" };
  return null;
}

/** 生成器の id の形でない表の主キー: primaryKey() の制約(名前つき)か、列の主キー(1 列、名前なし = 列の .primaryKey()) */
function primaryKeyOf(table) {
  const config = getTableConfig(table);
  const propOf = Object.fromEntries(Object.entries(getTableColumns(table)).map(([prop, column]) => [column.name, prop]));
  const constraint = config.primaryKeys[0];
  if (constraint) return { primaryKey: { columns: constraint.columns.map((column) => propOf[column.name]), name: constraint.getName() } };
  const primary = config.columns.filter((column) => column.primary);
  return primary.length === 1 ? { primaryKey: { columns: [propOf[primary[0].name]] } } : {};
}

/** 宣言の登録の idColumn(主キーの 1 列、無ければ id) */
function idColumnOf(entity, table) {
  if (entity.primaryKey?.columns?.length === 1) return getTableColumns(table)[entity.primaryKey.columns[0]]?.name ?? null;
  return "id";
}

/** 今の登録の行 → 登録の鍵(access は全部を apiAccess に書く = 動いている値。1 ファイルの宣言と違えば食い違いの行) */
function registrationKeysOf(entry, entryText, base, result) {
  const keys = {};
  const { row, key } = entry;
  const derived = accessOfDeclaration(base);
  if (!isDeepStrictEqual(derived, row.access)) {
    if (base.apiAccess || base.useImportExport !== undefined) result.discrepancies.push(`${key}: 権限: 宣言 ${JSON.stringify(derived)} / 動いている登録 ${JSON.stringify(row.access)} → 動いている値で書いた`);
    keys.apiAccess = structuredClone(row.access);
  }
  if (Array.isArray(row.requires) && row.requires.length > 0) keys.requires = [...row.requires];
  const service = serviceOf(entryText, key);
  if (service.problem) result.stops.push(`${key}: ${service.problem}`);
  else if (service.service) keys.service = service.service;
  const reason = reasonOf(entryText, key);
  if (reason) keys.reason = reason;
  return keys;
}

/** 表示の写しと管理一覧の値が前後で同じか(違えば止める) */
function guardViews(old, entity, allOld, result) {
  const config = { ...entity, label: old.label };
  if (!isDeepStrictEqual(toDomainDisplay(old, allOld), toDomainDisplay(config, allOld))) {
    result.stops.push(`${old.singular ?? old.plural}: 表示の写しが変わる(足した項目が写しに出る)。写しに出さない項目の書き方を決めてから起こす`);
  }
  const admin = (value) => ({ label: value.label, plural: value.plural, addToAdminDataMenu: value.addToAdminDataMenu === true });
  if (!isDeepStrictEqual(admin(old), admin(config))) result.stops.push(`${old.plural}: 管理一覧の値が変わる`);
}

/** 書く: 短い domain.json と entities/<登録名>/entity.json */
export function writePlan(repoRoot, plan) {
  fs.writeFileSync(path.join(repoRoot, plan.dir, "domain.json"), `${JSON.stringify(plan.domainJson, null, 2)}\n`);
  for (const registration of plan.registrations) {
    const dir = path.join(repoRoot, plan.dir, "entities", registration.name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, "entity.json"), `${JSON.stringify(registration.entity, null, 2)}\n`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const withPlace = args.includes("--with-place") && !write;
  const only = args.find((arg) => arg.startsWith("--domain="))?.slice("--domain=".length);
  const labelsFile = args.find((arg) => arg.startsWith("--labels="))?.slice("--labels=".length);
  const labels = labelsFile ? JSON.parse(fs.readFileSync(labelsFile, "utf8")) : {};
  const repoRoot = process.cwd();
  const map = readDistrictMapAt(repoRoot);
  const districts = map.districts.filter((row) => row.kind === "domains" && (!only || row.name === only));
  const allOld = map.districts
    .filter((row) => row.kind === "domains")
    .map((row) => readJson(path.join(repoRoot, row.dir, "domain.json")))
    .filter((config) => config && config.domainConfigVersion !== DOMAIN_DECLARATION_VERSION);
  const tempDir = makeTempDir();
  let stopped = 0;
  try {
    for (const district of districts) {
      const plan = await planDomain(repoRoot, district, map.tableFiles, labels, tempDir, allOld);
      if (withPlace && plan.stops.length === 0) {
        const neon = plan.registrations.filter((r) => (r.entity.dbEngine ?? "Neon") === "Neon");
        if (neon.length > 0) {
          const input = placementInput(repoRoot, plan.dir, neon);
          const placement = planPlacement(input);
          const problems = placement.stops.length > 0 ? placement.stops : [...checkExports(input, placement), ...readersOfRemoved(repoRoot, placement.removes)];
          plan.stops.push(...problems.map((line) => `置き場: ${line}`));
        }
      }
      const ok = plan.stops.length === 0;
      if (!ok) stopped++;
      console.log(`## ${plan.name} (${plan.dir}) ${ok ? "書ける" : "止めた"}: 登録 ${plan.registrations.map((r) => r.name).join(", ") || "0"}`);
      for (const line of plan.stops) console.log(`- 止めた: ${line}`);
      for (const line of plan.discrepancies) console.log(`- 動いている値で書いた: ${line}`);
      for (const line of plan.notes) console.log(`- ${line}`);
      if (ok && write) writePlan(repoRoot, plan);
    }
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  console.log(`\n${districts.length} ドメイン、止めた ${stopped}${write ? "(止めなかったドメインを書いた)" : "(計画だけ。--write で書く)"}`);
  process.exitCode = stopped > 0 ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
