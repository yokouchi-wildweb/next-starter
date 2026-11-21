// src/lib/domain/index.ts
// 入口 ".": client でも server でも読める物(閉じた lib。入口は "." / "./server" / "./node" の 3 つ、package.json)。
// "use client" は書かない(hooks のファイルがそれぞれ持つ)。server 専用 → "./server"(@/lib/domain/server)、
// Next の外のプログラム(scripts・eslint-rules)→ "./node"(node.mjs)。権限の型と定型は別の lib @/lib/domainAccess。
// 名前は 1 つずつ書く(export * にしない: tsx でテストが入口を読むとき名前が見えなくなる。入口の契約をここで読める)

// types: domain.json の形・写し・関連・登録表の型
export type { DomainDisplay, DomainDisplayField, DomainDisplayFieldGroup, DomainDisplayRelation } from "./types/display";
export type { DomainInfo, DomainInfoWithCount } from "./types/domain";
export type { DomainConfig, DomainConfigRelation } from "./types/domainConfig";
export type { DomainConfigOptionals } from "./types/domainConfigOptionals";
export type { DomainField, DomainFieldCollection, DomainFieldOption, DomainFieldOptionValue } from "./types/domainField";
export type { DomainFieldInfo } from "./types/field";
export type { JunctionTableInfo } from "./types/junction";
export type {
  DomainEntries,
  DomainEntryOverrides,
  DomainRegistry,
  DomainRegistryEntry,
  DomainService,
  DomainServiceLookup,
} from "./types/registry";
export type { HasManyRelationInfo, RelationInfo, RelationType } from "./types/relation";

// definition: domain.json の読み方・権限の解決・データ操作のコマンド
export { isDomainDataOperation, isGenericApiClosed, resolveAccessRule } from "./definition/apiAccess";
export { DATA_COMMAND_OPERATIONS, isDataCommand, resolveDataCommand, type DataCommandResolution } from "./definition/dataCommand";
export { normalizeDomainJsonConfig } from "./definition/normalizeDomainJsonConfig";
export { createDomainConfigLookup } from "./definition/createDomainConfigLookup";

// relations: リレーション情報と関連の選択肢の決まり(relationOptions.mjs は "./node" からも出る)
export { getRelationsOf, hasRelationsOf } from "./relations/utils";
export { getBelongsToRelationsOf } from "./relations/getBelongsToRelations";
export { getBelongsToManyRelationsOf } from "./relations/getBelongsToManyRelations";
export { getHasManyRelationsOf } from "./relations/getHasManyRelations";
export {
  RELATION_OPTIONS_KEY_PREFIX,
  domainsFromRelationOptionsKey,
  getFormRelations,
  getStaticRelations,
  isAsyncRelationFormInput,
  isCustomRelationFormInput,
  relationOptionsKey,
  type RelationOptionsConfig,
  type RelationOptionsRelation,
} from "./relations/relationOptions.mjs";

// fields: フィールド情報・項目の型の表・入力種別の表・表示の答え(.mjs は "./node" からも出る)
export { extractFields, getField, getFieldLabel, getFieldOptions } from "./fields/extractFields";
export { extractImageFields, hasImageFields } from "./fields/extractImageFields";
export type { BuiltinFormInput, FieldTypeName, FirestoreFieldType, NeonFieldType } from "./fields/fieldTypeNames";
export {
  FIELD_TYPES,
  MEDIA_FIELD_TYPES,
  allowsDefaultValue,
  collectMediaFields,
  collectOptionFields,
  columnFunction,
  columnOptionsLiteral,
  fieldTypeSpec,
  formDefaultFor,
  hasOptionFields,
  importValueShape,
  isArrayFieldType,
  isCheckGroupFieldType,
  isCollectionFieldType,
  isEmailFieldType,
  isEnumFieldType,
  isHashOnWriteFieldType,
  isMediaFieldType,
  isNumericFieldType,
  isRequiredByRefineFieldType,
  isTextFieldType,
  isTimestampFieldType,
  presenterKind,
  retiredFieldTypeMessage,
  tsType,
  zodType,
} from "./fields/fieldTypes.mjs";
export { FORM_INPUTS } from "./fields/fieldFormInputs.mjs";
export { BUILTIN_FORM_INPUTS } from "./fields/formInputs.mjs";
export { presenterFor, type PresenterKind, type PresenterSpec } from "./fields/presenterFor.mjs";

// junction: 中間テーブルの名前の決まり(表そのものを引く getJunctionTable は "./server")
export {
  getJunctionTableInfo,
  isJunctionTableName,
  parseJunctionTableName,
  resolveJunctionFieldName,
  resolveJunctionTableName,
} from "./junction/utils";

// 管理画面の全件削除の一覧(client の hooks と HTTP の client)
export { useFetchDomains } from "./hooks/useFetchDomains";
export { useTruncateDomains } from "./hooks/useTruncateDomains";
export {
  domainClient,
  fetchDomains,
  truncateDomains,
  type FetchDomainsResponse,
  type TruncatePayload,
  type TruncateResponse,
  type TruncateResult,
} from "./service/client/domainClient";
