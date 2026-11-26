// scripts/structure/cache の本体: ドメインの宣言 cache から、包んだ共有の読み <domain>/services/server/cachedReads.ts を作る。
// 宣言の読みは scripts/structure/domain の domain/workspace.mjs、検査は checks/cacheDeclarations.mjs・checks/cache.mjs、形と既定は spec/cache.mjs。
// 入口: generate.mjs(書く)・check.mjs(書かずに食い違いを名指す)。規則: README.md、宣言の書き方: src/domains/README.md「cache」

import fs from "node:fs";
import path from "node:path";

import { cacheDeclarationIssues } from "../domain/checks/cacheDeclarations.mjs";
import { readCacheDeclarations, readDomainRows } from "../domain/domain/workspace.mjs";
import { normalizeCacheDeclaration } from "../domain/spec/cache.mjs";

/** 生成物の置き場(ドメインのフォルダからの相対) */
export const CACHED_READS_FILE = path.join("services", "server", "cachedReads.ts");
/** 生成物の印(頭の行の始まり。消す時はこの印のあるファイルだけ消す) */
export const GENERATED_MARK = "// 生成物・編集不可: pnpm generate cache が ";

/** 主の登録の土台(services/server/<登録名>Base.ts、export <登録名>Base。キャッシュの宣言は主の登録 = ドメイン名の登録の entity.json) */
const baseFileOf = (row) => path.join("services", "server", `${row.name}Base.ts`);

const literal = (value) => JSON.stringify(value);
const IDENTIFIER_KEY = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
/** JSON の値 → TS のリテラル(識別子のキーは引用符なし、空白つき) */
function tsLiteral(value) {
  if (Array.isArray(value)) return `[${value.map(tsLiteral).join(", ")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value).map(([key, inner]) => `${IDENTIFIER_KEY.test(key) ? key : literal(key)}: ${tsLiteral(inner)}`);
    return entries.length ? `{ ${entries.join(", ")} }` : "{}";
  }
  return literal(value);
}
const lifeLiteral = (life) => tsLiteral(life);

/**
 * 1 つの読み = 指令を持つ cached<Name>(置き場に覚える)と、それを readThrough で包んだ <name>(置き場が止まって投げたら
 * base を直に読む。Next は handler の get の失敗を包まないため)
 */
function wrapped({ name, params, args, doc, body, call, domain }) {
  const cachedName = `cached${name[0].toUpperCase()}${name.slice(1)}`;
  return [
    `async function ${cachedName}(${params}) {\n${body}\n}`,
    `/** ${doc}。置き場が止まった時は DB を直に読む */\nconst ${name} = (${params}) => readThrough(${literal(`${domain}.${name}`)}, () => ${cachedName}(${args}), () => ${call});`,
  ].join("\n\n");
}

/** 1 つの読みの体(use cache: remote・cacheLife・cacheTag・base の呼び出し) */
function readBody({ life, mode, tags, call }) {
  const lines = ['  "use cache: remote";', `  cacheLife(${lifeLiteral(life)});`];
  if (mode === "tagged") lines.push(`  cacheTag(${tags.join(", ")});`);
  lines.push(`  return ${call};`);
  return lines.join("\n");
}

/**
 * 宣言 → cachedReads.ts の本文
 * @param {{ name: string, dir: string }} row ドメインの地区
 * @param {object} cache 検査を通った宣言
 * @param {string} source 宣言の置き場(リポの根からの相対)
 */
export function renderCachedReads(row, cache, source) {
  const declared = normalizeCacheDeclaration(cache);
  const d = literal(row.name);
  const relatedTags = declared.readsDomains.map((name) => `cacheTagOf(${literal(name)})`);
  const listTags = [`cacheTagOf(${d})`, ...relatedTags];
  const functions = [];
  const names = [];
  const usesRowsTag = declared.get && declared.mode === "tagged";

  if (declared.get) {
    names.push("get");
    functions.push(
      wrapped({
        name: "get",
        params: "id: string",
        args: "id",
        doc: `1 行を id で読む(行のキャッシュタグ・行の全部のキャッシュタグ${relatedTags.length ? "・読むドメインのキャッシュタグ" : ""})`,
        body: readBody({ life: declared.life, mode: declared.mode, tags: [`cacheTagOf(${d}, id)`, `cacheRowsTagOf(${d})`, ...relatedTags], call: `${row.name}Base.get(id)` }),
        call: `${row.name}Base.get(id)`,
        domain: row.name,
      }),
    );
  }
  if (declared.list) {
    names.push("list");
    const call = `${row.name}Base.search({ limit: ${declared.list.limit} })`;
    functions.push(
      wrapped({
        name: "list",
        params: "",
        args: "",
        doc: `上限つきの一覧(${declared.list.limit} 件まで)`,
        body: readBody({ life: declared.life, mode: declared.mode, tags: listTags, call }),
        call,
        domain: row.name,
      }),
    );
  }
  for (const read of declared.reads) {
    names.push(read.name);
    const params = [read.where && `where: ${tsLiteral(read.where)}`, read.orderBy && `orderBy: ${tsLiteral(read.orderBy)}`, `limit: ${read.limit}`].filter(Boolean);
    const call = `${row.name}Base.search({ ${params.join(", ")} })`;
    functions.push(
      wrapped({
        name: read.name,
        params: "",
        args: "",
        doc: `名前付きの読み ${read.name}(条件は宣言で固定、${read.limit} 件まで)`,
        body: readBody({ life: read.life, mode: read.mode, tags: listTags, call }),
        call,
        domain: row.name,
      }),
    );
  }

  const anyTagged = declared.mode === "tagged" || declared.reads.some((read) => read.mode === "tagged");
  const nextImports = anyTagged ? "cacheLife, cacheTag" : "cacheLife";
  const tagImports = [usesRowsTag && "cacheRowsTagOf", anyTagged && "cacheTagOf"].filter(Boolean);
  const exportName = `${row.name}CachedReads`;
  return [
    `${GENERATED_MARK}${source} の cache から生成する`,
    `// ${row.dir}/services/server/cachedReads.ts`,
    "//",
    "// 共有の読みのキャッシュ(\"use cache: remote\"、行き先は next.config の cacheHandlers、既定は Vercel の Runtime Cache)。",
    `// 書き込みは ${row.name}Base(${row.name}Base.ts の option cacheTags)がキャッシュタグを積み、入口が要求の終わりに消す(src/lib/cacheTags)。`,
    `// 判断の道(引く・買う・残高・在庫の引当など)はこの読みを使わず ${row.name}Base を直に読む。server だけが読む`,
    "",
    `import { ${nextImports} } from "next/cache";`,
    `import { ${[...tagImports, "readThrough"].join(", ")} } from "@/lib/cacheTags/server";`,
    "",
    `import { ${row.name}Base } from "./${row.name}Base";`,
    "",
    functions.join("\n\n"),
    "",
    `export const ${exportName} = { ${names.join(", ")} };`,
    "",
  ].join("\n");
}

/** 手書きの base が option cacheTags を持つか(generate: true のドメインは domain の生成器が書く) */
function baseIssues(rootDir, row) {
  const BASE_FILE = baseFileOf(row);
  const file = path.join(rootDir, row.dir, BASE_FILE);
  if (!fs.existsSync(file)) return [`[${row.name}] ${row.dir}/${BASE_FILE} がありません(包む読みは主の登録の土台 ${row.name}Base を読む)`];
  const text = fs.readFileSync(file, "utf8");
  const issues = [];
  if (!new RegExp(`export const ${row.name}Base\\b`).test(text)) issues.push(`[${row.name}] ${row.dir}/${BASE_FILE} に export const ${row.name}Base がありません`);
  if (!new RegExp(`cacheTags:\\s*\\{\\s*domain:\\s*"${row.name}"\\s*,?\\s*\\}`).test(text)) {
    issues.push(`[${row.name}] ${row.dir}/${BASE_FILE} の createCrudService に cacheTags: { domain: "${row.name}" } を書いてください(書き込みがキャッシュタグを積まないと包んだ読みが古いまま。generate: true のドメインは pnpm generate domain が書く)`);
  }
  return issues;
}

/**
 * 書く物・消す物・問題を出す(何も書かない)
 * @param {string} rootDir
 * @param {object[]} [rows] ドメインの地区(既定は今の木)
 * @returns {{ problems: string[], writes: Array<{ path: string, content: string }>, removes: string[] }}
 */
export function planCachedReads(rootDir, rows = readDomainRows(rootDir)) {
  const declarations = readCacheDeclarations(rootDir, rows);
  const { issues } = cacheDeclarationIssues(declarations);
  if (issues.length > 0) return { problems: issues, writes: [], removes: [] };
  const problems = [];
  const writes = [];
  const removes = [];
  for (const { row, cache, source } of declarations) {
    const target = path.join(row.dir, CACHED_READS_FILE);
    const absolute = path.join(rootDir, target);
    if (!cache) {
      if (fs.existsSync(absolute) && fs.readFileSync(absolute, "utf8").startsWith(GENERATED_MARK)) removes.push(target);
      continue;
    }
    problems.push(...baseIssues(rootDir, row));
    writes.push({ path: target, content: renderCachedReads(row, cache, source) });
  }
  return { problems, writes: problems.length > 0 ? [] : writes, removes: problems.length > 0 ? [] : removes };
}

/** 生成: 書いて消す。問題があれば何も書かない */
export function generateCachedReads(rootDir) {
  const plan = planCachedReads(rootDir);
  if (plan.problems.length > 0) return { ok: false, lines: [`cache: 問題 ${plan.problems.length} 件(何も書かない)`, ...plan.problems] };
  const lines = [];
  for (const { path: rel, content } of plan.writes) {
    const absolute = path.join(rootDir, rel);
    const before = fs.existsSync(absolute) ? fs.readFileSync(absolute, "utf8") : null;
    if (before === content) continue;
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, content);
    lines.push(`cache: ${before === null ? "作った" : "書き直した"} ${rel}`);
  }
  for (const rel of plan.removes) {
    fs.rmSync(path.join(rootDir, rel));
    lines.push(`cache: 宣言が無いので消した ${rel}`);
  }
  lines.push(`cache: 宣言 ${plan.writes.length} ドメイン`);
  return { ok: true, lines };
}

/** 検査: 書かずに、今の木と生成の結果の食い違いを名指す */
export function checkCachedReads(rootDir) {
  const plan = planCachedReads(rootDir);
  if (plan.problems.length > 0) return { ok: false, lines: [`cache: 問題 ${plan.problems.length} 件`, ...plan.problems] };
  const drift = [];
  for (const { path: rel, content } of plan.writes) {
    const absolute = path.join(rootDir, rel);
    if (!fs.existsSync(absolute)) drift.push(`無い: ${rel}`);
    else if (fs.readFileSync(absolute, "utf8") !== content) drift.push(`宣言と違う: ${rel}`);
  }
  for (const rel of plan.removes) drift.push(`宣言が無いのに残っている: ${rel}`);
  if (drift.length > 0) return { ok: false, lines: [`cache: 生成物が宣言と食い違う ${drift.length} 件(pnpm generate cache)`, ...drift] };
  return { ok: true, lines: [`cache: 宣言 ${plan.writes.length} ドメイン、生成物は宣言どおり`] };
}
