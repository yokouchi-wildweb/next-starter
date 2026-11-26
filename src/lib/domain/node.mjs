// src/lib/domain/node.mjs
// 入口 "./node": Next の外のプログラム(scripts の生成器・検査、eslint-rules、servers)が読む物。素の node で読めるよう JS だけで、
// React・Next を引かない。中身は項目の型の表・入力種別の表・表示の答え・関連の選択肢の決まり(どれも "." からも出る)と、
// ドメインの宣言の形と読み込みの部品(definition/declaration.mjs・readDomain.mjs。node:fs を読むので "./node" だけ)。
// scripts・eslint-rules からは相対(../src/lib/domain/node.mjs)、Next の外の .ts からは @/lib/domain/node.mjs

export * from "./fields/fieldTypes.mjs";
export * from "./fields/fieldFormInputs.mjs";
export * from "./fields/formInputs.mjs";
export * from "./fields/presenterFor.mjs";
export * from "./relations/relationOptions.mjs";
export {
  CHECK_KEYS,
  COLLECTION_KEYS,
  COLUMN_KEYS,
  DB_ENGINES,
  DB_OBJECT_KEYS,
  DB_OBJECT_KINDS,
  DECLARATION_COMMENT_KEY,
  DOMAIN_DECLARATION_FILE,
  DOMAIN_DECLARATION_VERSION,
  DOMAIN_KEYS,
  ENTITIES_DIR,
  ENTITY_DECLARATION_FILE,
  ENTITY_KEYS,
  ENTITY_NESTED_KEYS,
  ENTITY_REGISTRATION_KEYS,
  ENTITY_TABLE_KEYS,
  ENUM_KEYS,
  FIELD_GROUP_KEYS,
  FIELD_KEYS,
  FOREIGN_KEY_KEYS,
  FOREIGN_KEY_REFERENCE_KEYS,
  IDENTITY_VALUES,
  ID_TYPES,
  INDEX_KEYS,
  ON_DELETE_VALUES,
  PRIMARY_KEY_KEYS,
  RELATION_KEYS,
  RELATION_TYPES,
  SERVICE_KEYS,
  TABLE_COLUMN_KEYS,
  TABLE_KEYS,
  TABLE_SHAPE_KEYS,
  VALUES_FROM_KEYS,
} from "./definition/declaration.mjs";
export { listDomains, nodeDomainSource, readDomain, readDomains } from "./definition/readDomain.mjs";
