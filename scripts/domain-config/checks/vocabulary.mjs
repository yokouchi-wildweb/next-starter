// 検査: domain.json の語彙（spec/domainJson.mjs との照合）。綴り違い・古いキー・その DB に無い型・知らない入力種別を見つける。
// 生成器は未知の値を黙って通す（未知の fieldType は列名としてそのまま出る、未知の formInput は UI に出ない）ので、
// ここで警告する。生成は止めない（警告だけ）。

import {
  DB_ENGINES,
  FIELD_KEYS,
  FORM_INPUT_VALUES,
  GENERATE_FILE_KEYS,
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

function unknownKeys(object, known, legacy = {}) {
  const warnings = [];
  for (const key of Object.keys(object ?? {})) {
    if (known.has(key)) continue;
    if (key in legacy) warnings.push(`古いキー "${key}" は ${legacy[key]} に書き換えてください`);
    else warnings.push(`知らないキー "${key}"（綴りを確かめてください）`);
  }
  return warnings;
}

function topLevelWarnings(config) {
  const warnings = unknownKeys(config, TOP_LEVEL_KEYS, LEGACY_TOP_LEVEL_KEYS);
  if (config.dbEngine !== undefined && !DB_ENGINES.has(config.dbEngine)) {
    warnings.push(`dbEngine "${config.dbEngine}" は ${[...DB_ENGINES].join(" / ")} のどれでもありません`);
  }
  if (config.idType !== undefined && !ID_TYPES.has(config.idType)) {
    warnings.push(`idType "${config.idType}" は ${[...ID_TYPES].join(" / ")} のどれでもありません`);
  }
  warnings.push(...unknownKeys(config.generateFiles, GENERATE_FILE_KEYS).map((w) => `generateFiles: ${w}`));
  return warnings;
}

function fieldWarnings(config) {
  const warnings = [];
  const knownTypes = fieldTypesFor(config.dbEngine);
  (config.fields ?? []).forEach((field, index) => {
    const where = `fields[${index}] "${field?.name ?? "?"}"`;
    warnings.push(...unknownKeys(field, FIELD_KEYS).map((w) => `${where}: ${w}`));
    if (knownTypes.size > 0 && field?.fieldType !== undefined && !knownTypes.has(field.fieldType)) {
      warnings.push(`${where}: fieldType "${field.fieldType}" は ${config.dbEngine} に無い型です（そのまま列名に出ます）`);
    }
    if (field?.formInput !== undefined && !FORM_INPUT_VALUES.has(field.formInput)) {
      warnings.push(`${where}: formInput "${field.formInput}" は知らない入力種別です（フォームに出ません）`);
    }
  });
  return warnings;
}

function relationWarnings(config) {
  const warnings = [];
  (config.relations ?? []).forEach((relation, index) => {
    const where = `relations[${index}] "${relation?.domain ?? "?"}"`;
    warnings.push(...unknownKeys(relation, RELATION_KEYS, LEGACY_RELATION_KEYS).map((w) => `${where}: ${w}`));
    if (relation?.relationType !== undefined && !RELATION_TYPES.has(relation.relationType)) {
      warnings.push(`${where}: relationType "${relation.relationType}" は ${[...RELATION_TYPES].join(" / ")} のどれでもありません`);
    }
    if (relation?.onDelete !== undefined && !ON_DELETE_VALUES.has(relation.onDelete)) {
      warnings.push(`${where}: onDelete "${relation.onDelete}" は ${[...ON_DELETE_VALUES].join(" / ")} のどれでもありません`);
    }
    const allowedInputs = RELATION_FORM_INPUTS[relation?.relationType];
    if (relation?.formInput !== undefined && allowedInputs && !allowedInputs.has(relation.formInput)) {
      warnings.push(`${where}: formInput "${relation.formInput}" は ${relation.relationType} では使えません（${[...allowedInputs].join(" / ")}）`);
    }
  });
  return warnings;
}

/**
 * @param {object | null} config domain.json
 * @returns {string[]} 警告文（空なら問題なし）
 */
export function vocabularyWarnings(config) {
  if (!config || typeof config !== "object") return [];
  return [...topLevelWarnings(config), ...fieldWarnings(config), ...relationWarnings(config)];
}
