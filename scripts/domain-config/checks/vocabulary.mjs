// 検査: domain.json の語彙（spec/domainJson.mjs との照合）。綴り違い・古いキー・その DB に無い型を見つける（知らない入力種別は checks/formInputNames.mjs が止める）。
// 生成器は未知の値を黙って通す（未知の fieldType は列名としてそのまま出る、未知の formInput は UI に出ない）ので、
// ここで警告する。生成は止めない（警告だけ）。

// 知らないキーは、同じキーを 1 行にまとめる（件数と最初の数か所）。メモ代わりのキーを全項目に書くと警告が項目の数だけ並び、
// 値の誤り・古いキーなど大事な警告が埋もれるため。並びは 値の誤り・古いキー → まとめた知らないキー の順。
// 開発者のメモは "$comment"（COMMENT_KEY）に書く。どの階層でも知っているキーとして通り、値の形（文字列か文字列の配列）だけを見る

import {
  COLLECTION_KEYS,
  COMMENT_KEY,
  DB_ENGINES,
  FIELD_GROUP_KEYS,
  FIELD_KEYS,
  ID_TYPES,
  LEGACY_RELATION_KEYS,
  LEGACY_TOP_LEVEL_KEYS,
  ON_DELETE_VALUES,
  RELATION_FORM_INPUTS,
  RELATION_KEYS,
  RELATION_TYPES,
  TOP_LEVEL_KEYS,
  fieldTypesFor,
} from "../spec/domainJson.mjs";

/** まとめた行に並べる場所の数（それ以上は「…」） */
const SHOWN_LOCATIONS = 3;

const isComment = (value) => typeof value === "string" || (Array.isArray(value) && value.every((line) => typeof line === "string"));

/**
 * 1 つのオブジェクトのキーを見る。古いキーと $comment の値の形は warnings に、知らないキーは unknown に場所を積む
 * @param {{ warnings: string[], unknown: Map<string, string[]> }} acc
 * @param {string} location まとめた行に出す場所（例: fields.title）
 * @param {string} prefix 個別の警告の前に付ける文字列（トップレベルは空）
 */
function checkKeys(acc, object, known, legacy, location, prefix) {
  if (!object || typeof object !== "object" || Array.isArray(object)) return;
  for (const key of Object.keys(object)) {
    if (key === COMMENT_KEY) {
      if (!isComment(object[key])) acc.warnings.push(`${prefix}${COMMENT_KEY} は文字列か文字列の配列で書いてください`);
      continue;
    }
    if (known.has(key)) continue;
    if (key in legacy) {
      acc.warnings.push(`${prefix}古いキー "${key}" は ${legacy[key]} に書き換えてください`);
      continue;
    }
    if (!acc.unknown.has(key)) acc.unknown.set(key, []);
    acc.unknown.get(key).push(location);
  }
}

function unknownKeyLines(unknown) {
  return [...unknown].map(([key, locations]) => {
    const shown = locations.slice(0, SHOWN_LOCATIONS).join(", ") + (locations.length > SHOWN_LOCATIONS ? ", …" : "");
    return `知らないキー "${key}": ${locations.length} か所（${shown}）。綴りを確かめてください（開発者のメモなら "${COMMENT_KEY}" に書く）`;
  });
}

function topLevelWarnings(acc, config) {
  checkKeys(acc, config, TOP_LEVEL_KEYS, LEGACY_TOP_LEVEL_KEYS, "トップレベル", "");
  if (config.dbEngine !== undefined && !DB_ENGINES.has(config.dbEngine)) {
    acc.warnings.push(`dbEngine "${config.dbEngine}" は ${[...DB_ENGINES].join(" / ")} のどれでもありません`);
  }
  if (config.idType !== undefined && !ID_TYPES.has(config.idType)) {
    acc.warnings.push(`idType "${config.idType}" は ${[...ID_TYPES].join(" / ")} のどれでもありません`);
  }
}

/** 主の集まりの項目の collection（下位キーの型だけ。従属ドメインの存在など組をまたぐ検査は生成時） */
function collectionWarnings(acc, collection, location, where) {
  if (collection === undefined) return;
  if (!collection || typeof collection !== "object" || Array.isArray(collection)) {
    acc.warnings.push(`${where}: collection はオブジェクトで書いてください`);
    return;
  }
  checkKeys(acc, collection, COLLECTION_KEYS, {}, `${location}.collection`, `${where}: collection: `);
  if (collection.domain !== undefined && (typeof collection.domain !== "string" || collection.domain.length === 0)) {
    acc.warnings.push(`${where}: collection.domain は従属ドメインの singular（空でない文字列）にしてください`);
  }
  if (collection.maxItems !== undefined && (!Number.isInteger(collection.maxItems) || collection.maxItems < 1)) {
    acc.warnings.push(`${where}: collection.maxItems は 1 以上の整数にしてください`);
  }
  if (collection.duplicate !== undefined && typeof collection.duplicate !== "boolean") {
    acc.warnings.push(`${where}: collection.duplicate は true か false にしてください`);
  }
}

function fieldWarnings(acc, config) {
  const knownTypes = fieldTypesFor(config.dbEngine);
  (config.fields ?? []).forEach((field, index) => {
    const where = `fields[${index}] "${field?.name ?? "?"}"`;
    const location = `fields.${field?.name ?? index}`;
    checkKeys(acc, field, FIELD_KEYS, {}, location, `${where}: `);
    if (knownTypes.size > 0 && field?.fieldType !== undefined && !knownTypes.has(field.fieldType)) {
      acc.warnings.push(`${where}: fieldType "${field.fieldType}" は ${config.dbEngine} に無い型です（そのまま列名に出ます）`);
    }
    collectionWarnings(acc, field?.collection, location, where);
  });
}

function fieldGroupWarnings(acc, config) {
  if (!Array.isArray(config.fieldGroups)) return;
  config.fieldGroups.forEach((group, index) => {
    const where = `fieldGroups[${index}] "${group?.key ?? "?"}"`;
    checkKeys(acc, group, FIELD_GROUP_KEYS, {}, `fieldGroups.${group?.key ?? index}`, `${where}: `);
  });
}

function relationWarnings(acc, config, registeredInputs) {
  (config.relations ?? []).forEach((relation, index) => {
    const where = `relations[${index}] "${relation?.domain ?? "?"}"`;
    checkKeys(acc, relation, RELATION_KEYS, LEGACY_RELATION_KEYS, `relations.${relation?.domain ?? index}`, `${where}: `);
    if (relation?.relationType !== undefined && !RELATION_TYPES.has(relation.relationType)) {
      acc.warnings.push(`${where}: relationType "${relation.relationType}" は ${[...RELATION_TYPES].join(" / ")} のどれでもありません`);
    }
    if (relation?.onDelete !== undefined && !ON_DELETE_VALUES.has(relation.onDelete)) {
      acc.warnings.push(`${where}: onDelete "${relation.onDelete}" は ${[...ON_DELETE_VALUES].join(" / ")} のどれでもありません`);
    }
    const allowedInputs = RELATION_FORM_INPUTS[relation?.relationType];
    if (relation?.formInput !== undefined && allowedInputs && !allowedInputs.has(relation.formInput) && !registeredInputs.has(relation.formInput)) {
      acc.warnings.push(`${where}: formInput "${relation.formInput}" は ${relation.relationType} では使えません（${[...allowedInputs].join(" / ")}）`);
    }
  });
}

/**
 * 語彙の照合の結果を 2 つに分けて返す（preflightWarnings が知らないキーを他の検査の警告より後ろに並べるため）
 * @param {object | null} config domain.json
 * @returns {{ warnings: string[], unknownKeys: string[] }} warnings = 値の誤り・古いキー・$comment の形、unknownKeys = 知らないキー（キーごとに 1 行）
 */
export function vocabularyReport(config, registeredInputs = new Set()) {
  if (!config || typeof config !== "object") return { warnings: [], unknownKeys: [] };
  const acc = { warnings: [], unknown: new Map() };
  topLevelWarnings(acc, config);
  fieldWarnings(acc, config);
  fieldGroupWarnings(acc, config);
  relationWarnings(acc, config, registeredInputs);
  return { warnings: acc.warnings, unknownKeys: unknownKeyLines(acc.unknown) };
}

/**
 * @param {object | null} config domain.json
 * @returns {string[]} 警告文（空なら問題なし）。値の誤り・古いキーが先、知らないキーはキーごとに 1 行で最後
 */
export function vocabularyWarnings(config, registeredInputs = new Set()) {
  const { warnings, unknownKeys } = vocabularyReport(config, registeredInputs);
  return [...warnings, ...unknownKeys];
}
