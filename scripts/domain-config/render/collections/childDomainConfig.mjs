// 主の集まりの項目（fieldType mediaCollection）から、従属ドメインの domain.json の中身を組む純関数。
// 従属 = 主に belongsTo（必須・CASCADE）するメディア 1 枚ずつの行。汎用 API と管理画面は閉じて生まれ、主の画面から読み書きする。
// ファイルの権限は主の汎用 API の規則から写す（写せるのは public / authenticated / ロールの規則だけ。それ以外は管理者のみ + 直す場所の案内）

import { defaultChildName } from "../../spec/collectionField.mjs";
import { DOMAIN_CONFIG_VERSION } from "../../spec/version.mjs";
import { toCamelCase, toSnakeCase } from "../../../../src/utils/stringCase.mjs";
import { ADMIN_RULE, isValidRule, unionUploadRules } from "../registry/storagePurpose/rules.mjs";

const READ_OPERATIONS = new Set(["get"]);
const SORT_FIELD = "sort_order";
const DEFAULT_MAX_SIZE_BYTES = 10 * 1024 * 1024;

/** 主の idType → belongsTo の外部キーの型（DB 採番は数値） */
const FOREIGN_KEY_TYPES = { uuid: "uuid", string: "string", number: "number", db: "number" };

/** 主の 1 操作の規則を、汎用 API と同じ順（operations → read / write）で生のまま取る。どこにも無ければ undefined */
function rawRule(apiAccess, operation) {
  const opRule = apiAccess?.operations?.[operation];
  if (opRule !== undefined) return opRule;
  return READ_OPERATIONS.has(operation) ? apiAccess?.read : apiAccess?.write;
}

/** 写せる規則か（public / authenticated / ロールの規則）。none（閉じた API）や知らない値（custom など）は写せない */
const isCopyableRule = (rule) => rule !== "none" && isValidRule(rule);

/**
 * 主の操作の規則を写す。宣言が無ければ fail-closed の既定（管理者のみ）がそのまま本当の規則なので写す。
 * 写せなければ null（雛形は管理者のみ + 案内にし、組の権限の検査は飛ばす）
 */
export function parentRule(parentConfig, operation) {
  if (parentConfig.generateFiles?.registry === false) return null; // domainEntry.ts が手書き = apiAccess は正でない
  const rule = rawRule(parentConfig.apiAccess, operation);
  if (rule === undefined) return ADMIN_RULE;
  return isCopyableRule(rule) ? rule : null;
}

/**
 * 従属のメディア項目の storage（visibility / upload / read）と、直す場所の案内の対象
 * @returns {{ storage: { visibility: string, upload: unknown, read: unknown }, uncopied: string[] }}
 */
export function childStorageRules(parentConfig) {
  const uncopied = [];
  const create = parentRule(parentConfig, "create");
  const update = parentRule(parentConfig, "update");
  let upload;
  if (create === null || update === null) {
    upload = ADMIN_RULE;
    uncopied.push("upload");
  } else {
    upload = unionUploadRules([create, update]);
  }
  let read = parentRule(parentConfig, "get");
  if (read === null) {
    read = ADMIN_RULE;
    uncopied.push("read");
  }
  return { storage: { visibility: read === "public" ? "public" : "private", upload, read }, uncopied };
}

/**
 * @param {{ singular: string, label?: string, idType?: string, apiAccess?: object, generateFiles?: object }} parentConfig 主の domain.json
 * @param {{ name: string, label: string, collection: { domain: string } }} field 主の集まりの項目
 * @returns {{ config: object, uncopied: string[] }} 従属の domain.json と、写せず管理者のみにした storage のキー（upload / read）
 */
export function buildChildDomainConfig(parentConfig, field) {
  const parentSnake = toSnakeCase(parentConfig.singular);
  const singular = field.collection.domain;
  const suggested = defaultChildName(parentConfig.singular, field.name);
  // 既定の名前のままなら plural も既定（項目名）。名前を変えていれば推定に任せる
  const plural = singular === suggested.singular ? suggested.plural : undefined;
  const { storage, uncopied } = childStorageRules(parentConfig);
  const config = {
    domainConfigVersion: DOMAIN_CONFIG_VERSION,
    singular,
    ...(plural ? { plural } : {}),
    label: field.label,
    dbEngine: "Neon",
    idType: parentConfig.idType,
    relations: [
      {
        domain: parentSnake,
        label: parentConfig.label ?? parentSnake,
        fieldName: `${parentSnake}_id`,
        fieldType: FOREIGN_KEY_TYPES[parentConfig.idType] ?? "uuid",
        relationType: "belongsTo",
        required: true,
        onDelete: "CASCADE",
      },
    ],
    useCreatedAt: true,
    useUpdatedAt: true,
    useSoftDelete: false,
    sortOrderField: SORT_FIELD,
    fields: [
      {
        name: "file",
        label: field.label,
        fieldType: "mediaUploader",
        formInput: "mediaUploader",
        required: true,
        slug: toCamelCase(field.name),
        mediaTypePreset: "images",
        accept: "image/*",
        validationRule: { maxSizeBytes: DEFAULT_MAX_SIZE_BYTES },
        storage,
      },
      { name: SORT_FIELD, label: "並び順", fieldType: "string", formInput: "hidden", required: false },
    ],
    systemColumns: [SORT_FIELD],
    addToAdminDataMenu: false,
    apiAccess: { read: "none", write: "none" },
    generateFiles: {
      entities: true,
      components: false,
      hooks: false,
      clientServices: false,
      serverServices: true,
      fieldConstants: true,
      adminRoutes: false,
      registry: true,
      presenters: true,
    },
  };
  return { config, uncopied };
}
