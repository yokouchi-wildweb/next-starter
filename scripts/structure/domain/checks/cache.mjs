// 検査: 登録の宣言 cache の形(登録の entity.json の "cache" と fork の上書き entity.override.ts の cache、D353)。
// 書き間違いは「消えないキャッシュ」「寿命の無いキャッシュ」として黙って出るので、生成の前に止める。
// 規則の正: src/domains/README.md「cache(共有の読みのキャッシュの宣言)」、語彙: spec/cache.mjs

import { toCamelCase } from "../../../../src/lib/stringCase/index.mjs";
import {
  CACHE_KEYS,
  CACHE_LIFE_KEYS,
  CACHE_LIFE_LIMITS,
  CACHE_LIFE_PRESETS,
  CACHE_LIST_KEYS,
  CACHE_MAX_LIMIT,
  CACHE_MAX_READS_DOMAINS,
  CACHE_MODES,
  CACHE_READ_KEYS,
  CACHE_WHERE_NO_VALUE_OPS,
  CACHE_WHERE_OPS,
  cacheLifeExpire,
} from "../spec/cache.mjs";

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const IDENTIFIER = /^[a-z][A-Za-z0-9]*$/;
/** 包む読みの名前で使えない物(get / list は生成器の決まった名前) */
const RESERVED_READ_NAMES = new Set(["get", "list"]);

/** where / orderBy に書ける列(TS の列名 = camelCase): id・時刻・項目・belongsTo の FK・並びの列 */
function columnNames(config) {
  const names = new Set(["id"]);
  if (config.useCreatedAt !== false) names.add("createdAt");
  if (config.useUpdatedAt !== false) names.add("updatedAt");
  if (config.useSoftDelete) names.add("deletedAt");
  if (config.sortOrderField) names.add(toCamelCase(config.sortOrderField));
  for (const field of config.fields ?? []) if (field?.name) names.add(toCamelCase(field.name));
  for (const relation of config.relations ?? []) {
    if (relation?.relationType === "belongsTo" && relation.fieldName) names.add(toCamelCase(relation.fieldName));
  }
  return names;
}

function lifeIssues(where, life, mode) {
  if (life === undefined) return [`${where}.life を書いてください(寿命は必ず有限: ${Object.keys(CACHE_LIFE_PRESETS).join(" / ")} か { stale?, revalidate?, expire }(秒))`];
  if (typeof life === "string") {
    if (life === "default") return [`${where}.life に "default" は書けません(expire が無く寿命が無限になる)`];
    if (life === "seconds") return [`${where}.life に "seconds" は書けません(revalidate 1 秒で、読むたびに作り直すのと同じ。短い寿命は { revalidate, expire } の秒か "minutes")`];
    if (!Object.hasOwn(CACHE_LIFE_PRESETS, life)) return [`${where}.life の ${JSON.stringify(life)} は preset にありません(${Object.keys(CACHE_LIFE_PRESETS).join(" / ")})`];
  } else if (isObject(life)) {
    const issues = Object.keys(life).filter((key) => !CACHE_LIFE_KEYS.has(key)).map((key) => `${where}.life: 知らないキー ${key}(書けるのは ${[...CACHE_LIFE_KEYS].join(" / ")})`);
    for (const key of CACHE_LIFE_KEYS) {
      if (life[key] !== undefined && !(Number.isInteger(life[key]) && life[key] > 0)) issues.push(`${where}.life.${key} は正の整数(秒)にしてください(今: ${JSON.stringify(life[key])})`);
    }
    if (life.expire === undefined) issues.push(`${where}.life.expire を書いてください(寿命は必ず有限)`);
    const order = ["stale", "revalidate", "expire"].filter((key) => Number.isInteger(life[key]));
    for (let i = 1; i < order.length; i += 1) {
      if (life[order[i - 1]] > life[order[i]]) issues.push(`${where}.life は stale ≤ revalidate ≤ expire にしてください(${order[i - 1]} ${life[order[i - 1]]} > ${order[i]} ${life[order[i]]})`);
    }
    if (issues.length > 0) return issues;
  } else {
    return [`${where}.life は preset 名か { stale?, revalidate?, expire } で書いてください`];
  }
  const expire = cacheLifeExpire(life);
  const limit = CACHE_MODES.has(mode) ? CACHE_LIFE_LIMITS[mode] : null;
  if (limit !== null && expire > limit) return [`${where}.life の寿命 ${expire} 秒は ${mode} の上限 ${limit} 秒を超えます`];
  return [];
}

function limitIssues(where, limit) {
  if (Number.isInteger(limit) && limit >= 1 && limit <= CACHE_MAX_LIMIT) return [];
  return [`${where}.limit は 1〜${CACHE_MAX_LIMIT} の整数で書いてください(今: ${JSON.stringify(limit)})`];
}

function whereIssues(where, expr, columns) {
  if (!isObject(expr)) return [`${where} は { field, op, value } か { and: [...] } / { or: [...] } で書いてください`];
  if ("and" in expr || "or" in expr) {
    const key = "and" in expr ? "and" : "or";
    if (Object.keys(expr).length !== 1 || !Array.isArray(expr[key]) || expr[key].length === 0) return [`${where}.${key} は条件の空でない配列だけで書いてください`];
    return expr[key].flatMap((child, index) => whereIssues(`${where}.${key}[${index}]`, child, columns));
  }
  const issues = Object.keys(expr).filter((key) => !["field", "op", "value"].includes(key)).map((key) => `${where}: 知らないキー ${key}(field / op / value)`);
  if (typeof expr.field !== "string" || !expr.field) issues.push(`${where}.field を列名で書いてください`);
  else if (columns && !columns.has(expr.field)) issues.push(`${where}.field の ${JSON.stringify(expr.field)} が列にありません(camelCase の列名: ${[...columns].join(" / ")})`);
  if (!CACHE_WHERE_OPS.has(expr.op)) issues.push(`${where}.op の ${JSON.stringify(expr.op)} は使えません(${[...CACHE_WHERE_OPS].join(" / ")})`);
  else if (!CACHE_WHERE_NO_VALUE_OPS.has(expr.op) && !("value" in expr)) issues.push(`${where}.value を書いてください(op ${expr.op})`);
  return issues;
}

function orderByIssues(where, orderBy, columns) {
  if (!Array.isArray(orderBy) || orderBy.length === 0) return [`${where} は [[列, "ASC"|"DESC", ("FIRST"|"LAST")?], ...] で書いてください`];
  return orderBy.flatMap((item, index) => {
    const at = `${where}[${index}]`;
    if (!Array.isArray(item) || item.length < 2 || item.length > 3) return [`${at} は [列, "ASC"|"DESC", ("FIRST"|"LAST")?] で書いてください`];
    const [field, direction, nulls] = item;
    const issues = [];
    if (typeof field !== "string" || !field) issues.push(`${at} の列名を書いてください`);
    else if (columns && !columns.has(field)) issues.push(`${at} の ${JSON.stringify(field)} が列にありません`);
    if (direction !== "ASC" && direction !== "DESC") issues.push(`${at} の向きは "ASC" か "DESC" にしてください`);
    if (nulls !== undefined && nulls !== "FIRST" && nulls !== "LAST") issues.push(`${at} の 3 つ目は "FIRST" か "LAST" にしてください`);
    return issues;
  });
}

/**
 * @param {object} cache 宣言(登録の entity.json の cache か、fork の上書きの cache)
 * @param {object} options
 * @param {string} options.domain 宣言の持ち主の登録名(= キャッシュタグの名前、camelCase。readsDomains の自分を見分ける)
 * @param {Set<string>} [options.domains] 地区の地図のドメイン名の全部(無ければ readsDomains の在りかは見ない)
 * @param {object} [options.config] 登録の entity.json(列と dbEngine を見る。無ければ列は形だけ)
 * @returns {string[]} 問題(空なら無し)
 */
export function cacheIssues(cache, { domain, domains, config } = {}) {
  if (!isObject(cache)) return ["cache は { mode, life, ... } のオブジェクトで書いてください"];
  const issues = Object.keys(cache).filter((key) => !CACHE_KEYS.has(key)).map((key) => `cache: 知らないキー ${key}(書けるのは ${[...CACHE_KEYS].join(" / ")})`);
  if (config && config.dbEngine !== "Neon") issues.push(`cache は Neon のドメインだけで使えます(今: ${JSON.stringify(config.dbEngine)})`);
  if (!CACHE_MODES.has(cache.mode)) issues.push(`cache.mode は ${[...CACHE_MODES].join(" / ")} にしてください(今: ${JSON.stringify(cache.mode)})`);
  issues.push(...lifeIssues("cache", cache.life, cache.mode));
  if (cache.get !== undefined && typeof cache.get !== "boolean") issues.push("cache.get は true か false にしてください");

  if (cache.list !== undefined) {
    if (!isObject(cache.list)) issues.push("cache.list は { limit } で書いてください");
    else {
      issues.push(...Object.keys(cache.list).filter((key) => !CACHE_LIST_KEYS.has(key)).map((key) => `cache.list: 知らないキー ${key}(limit)`));
      issues.push(...limitIssues("cache.list", cache.list.limit));
    }
  }

  const columns = config ? columnNames(config) : null;
  if (cache.reads !== undefined) {
    if (!Array.isArray(cache.reads)) issues.push("cache.reads は名前付きの読みの配列で書いてください");
    else {
      const names = new Set();
      cache.reads.forEach((read, index) => {
        const where = `cache.reads[${index}]`;
        if (!isObject(read)) {
          issues.push(`${where} は { name, where?, orderBy?, limit, mode?, life? } で書いてください`);
          return;
        }
        issues.push(...Object.keys(read).filter((key) => !CACHE_READ_KEYS.has(key)).map((key) => `${where}: 知らないキー ${key}(書けるのは ${[...CACHE_READ_KEYS].join(" / ")}。名前付きの読みは引数を取らない)`));
        if (typeof read.name !== "string" || !IDENTIFIER.test(read.name)) issues.push(`${where}.name は小文字で始まる英数字の名前にしてください(今: ${JSON.stringify(read.name)})`);
        else if (RESERVED_READ_NAMES.has(read.name)) issues.push(`${where}.name の ${read.name} は使えません(get / list は生成器の決まった読み)`);
        else if (names.has(read.name)) issues.push(`${where}.name の ${read.name} が重なっています`);
        else names.add(read.name);
        if (read.where !== undefined) issues.push(...whereIssues(`${where}.where`, read.where, columns));
        if (read.orderBy !== undefined) issues.push(...orderByIssues(`${where}.orderBy`, read.orderBy, columns));
        issues.push(...limitIssues(where, read.limit));
        if (read.mode !== undefined && !CACHE_MODES.has(read.mode)) issues.push(`${where}.mode は ${[...CACHE_MODES].join(" / ")} にしてください`);
        if (read.life !== undefined || read.mode !== undefined) issues.push(...lifeIssues(where, read.life ?? cache.life, read.mode ?? cache.mode));
      });
    }
  }

  if (cache.readsDomains !== undefined) {
    if (!Array.isArray(cache.readsDomains)) issues.push("cache.readsDomains はドメイン名(地区の地図の名前)の配列で書いてください");
    else {
      if (cache.readsDomains.length > CACHE_MAX_READS_DOMAINS) issues.push(`cache.readsDomains は ${CACHE_MAX_READS_DOMAINS} 個までにしてください(今: ${cache.readsDomains.length}。1 項目のキャッシュタグは 128 まで)`);
      const seen = new Set();
      for (const name of cache.readsDomains) {
        if (typeof name !== "string" || !name) issues.push(`cache.readsDomains の ${JSON.stringify(name)} はドメイン名にしてください`);
        else if (name === domain) issues.push(`cache.readsDomains に自分(${name})は書けません(自分のキャッシュタグは必ず付く)`);
        else if (seen.has(name)) issues.push(`cache.readsDomains の ${name} が重なっています`);
        else if (domains && !domains.has(name)) issues.push(`cache.readsDomains の ${name} は地区の地図のドメインにありません`);
        seen.add(name);
      }
    }
  }
  return issues;
}
