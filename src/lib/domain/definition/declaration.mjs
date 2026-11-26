// src/lib/domain/definition/declaration.mjs
// ドメインの宣言の形(D335): ドメインそのものの短い宣言 src/domains/<d>/domain.json と、表 1 つ = 登録 1 件ごとの宣言
// src/domains/<d>/entities/<登録名>/entity.json。登録の一覧はフォルダの並びで、どこにも手で書かない。読むのは ./readDomain.mjs だけ。
// 鍵と値の集合の正はこのファイル(今の 1 ファイルの domain.json の語彙 scripts/structure/domain/spec/domainJson.mjs もここから組む)。
// 素の node で読めるよう JS だけ(入口 "./node")

/** ドメインの宣言のファイル名(ドメインのフォルダの直下) */
export const DOMAIN_DECLARATION_FILE = "domain.json";
/** 登録の宣言のフォルダ(ドメインのフォルダの直下)。その下のフォルダ 1 つ = 登録 1 件、フォルダ名 = 登録名 */
export const ENTITIES_DIR = "entities";
/** 登録の宣言のファイル名(entities/<登録名>/ の直下) */
export const ENTITY_DECLARATION_FILE = "entity.json";
/**
 * 登録のフォルダの表のファイルの種類(entities/<登録名>/<種類>.ts。entities/<種類>.ts はそれを集める入口)。
 * entities/ の下のフォルダのうち entity.json かこの種類のファイルを持つ物が登録(ほかのフォルダ = 役割の表 profiles/ など、登録でない)
 */
export const ENTITY_FILE_KINDS = Object.freeze(["drizzle", "schema", "form", "model"]);

/** この形の版(domain.json の domainConfigVersion)。今の 1 ファイルの形は "1.x" */
export const DOMAIN_DECLARATION_VERSION = "2.0";

/** 開発者のメモの鍵(JSON Schema の注記と同じ名前)。どの階層にも書け、道具は読まない。値は文字列か文字列の配列 */
export const DECLARATION_COMMENT_KEY = "$comment";

export const DB_ENGINES = new Set(["Neon", "Firestore"]);
export const ID_TYPES = new Set(["uuid", "string", "number"]);

/**
 * domain.json の鍵(ドメインそのもの。表の事実は持たない)
 * - domainConfigVersion: この形の版(DOMAIN_DECLARATION_VERSION)
 * - label: ドメインの表示名(管理の一覧・データ操作の一覧)
 */
export const DOMAIN_KEYS = new Set(["domainConfigVersion", "label", DECLARATION_COMMENT_KEY]);

/** 表と汎用の一式の鍵のうち、今の 1 ファイルの domain.json と同じ意味で持つ物(今の形の語彙もこれから組む) */
export const TABLE_KEYS = new Set([
  "singular", "plural", "label", "dbEngine", "idType", "relations", "useCreatedAt", "useUpdatedAt",
  "useSoftDelete", "sortOrderField", "fields", "fieldGroups", "searchFields", "searchRank", "defaultOrderBy", "tableFields",
  "useDetailModal", "addToAdminDataMenu", "useDuplicateButton", "useImportExport", "useAutoSave", "indexes",
  "systemColumns", "hiddenColumns", "apiAccess", "audit", "cache",
]);

/**
 * 手で持つ表の形の鍵(entity.json だけ。今の 1 ファイルの形では書けなかった物、Neon のみ)
 * - table: 表の物理名(省略 = snake(plural))
 * - primaryKey: 主キー { columns, name? }(省略 = idType の id 列 1 つ)
 * - foreignKeys: relations で言えない外部キー(名前つき・2 本目・自己参照・別の表の列)
 * - checks: check 制約 { name, sql }
 * - enums: pgEnum { name, values } か、設定から値を作る { name, valuesFrom: { file, export } }(照らしは読み込んだ値で比べる)
 * - dbObjects: drizzle で書けない DB の物を SQL のファイルで名指す { kind, file }
 * - columns: 表だけの列 [{ name, column }](画面・フォームの項目でない表の事実。column.type か column.enum は必ず書く)。
 *   項目(fields = 画面・フォームが知る物)と列(columns = 表の事実だけ)の 1 つの列はどちらか一方にだけ書く
 * ユニークは indexes[] の unique:true だけで書く(今の形の compositeUniques は entity.json に持たない)
 */
export const TABLE_SHAPE_KEYS = new Set(["table", "primaryKey", "foreignKeys", "checks", "enums", "dbObjects", "columns"]);

/** entity.json の表の鍵の全部 */
export const ENTITY_TABLE_KEYS = new Set([...TABLE_KEYS, ...TABLE_SHAPE_KEYS]);

/**
 * entity.json の鍵のうち、登録の鍵(今は手書きの domainEntry.ts にしかない事実)
 * - generate: 生成器がこの登録の 4 ファイル(schema・form・model・drizzle)と汎用の一式を書くか(省略 = true、手で持つ登録は false、D337)
 * - registered: 汎用の登録(登録表 serviceRegistry)に出すか(省略 = true。false = 表だけを持ち、サービスの名前では引かない)
 * - reason: registered:false の理由、または apiAccess を閉じた・細かくした理由(人が読む 1 文)
 * - requires: 前提の機能(門番の依存の検査が読む、今の domainEntry.ts の requires)
 * - service: 登録のサービスの結び付き { file, export }(services/server/ からの相対・export 名)。既定 <登録名>Service と違う時だけ
 */
export const ENTITY_REGISTRATION_KEYS = new Set(["generate", "registered", "reason", "requires", "service"]);

/** entity.json の鍵の全部 */
export const ENTITY_KEYS = new Set([...ENTITY_TABLE_KEYS, ...ENTITY_REGISTRATION_KEYS, DECLARATION_COMMENT_KEY]);

/**
 * 関連(relations[])の鍵。entity.json だけの鍵: unique = belongsTo の外部キーの列のユニーク(1 対 1)、
 * foreignKey = false で外部キーの制約を作らない(列だけ。表に制約の無い関連)
 */
export const RELATION_KEYS = new Set(["domain", "label", "fieldName", "fieldType", "relationType", "required", "onDelete", "includeRelationTable", "labelField", "formInput", "unique", "foreignKey", DECLARATION_COMMENT_KEY]);
export const RELATION_TYPES = new Set(["belongsTo", "hasMany", "hasOne", "belongsToMany"]);
export const ON_DELETE_VALUES = new Set(["RESTRICT", "CASCADE", "SET_NULL"]);

/** 項目(fields[])の鍵(lib/domain の DomainField の鍵と同じ + 列の形 column) */
export const FIELD_KEYS = new Set([
  "name", "label", "fieldType", "formInput", "required", "readonly", "disabled", "defaultValue", "options", "displayType", "placeholder",
  "slug", "mediaTypePreset", "accept", "validationRule", "helperText", "metadataBinding", "reorderable", "unique", "storage", "collection",
  "column", DECLARATION_COMMENT_KEY,
]);

/** 主の集まりの項目(fieldType mediaCollection)の collection の鍵: 従属ドメインの singular・最大件数・複製で写すか */
export const COLLECTION_KEYS = new Set(["domain", "maxItems", "duplicate", DECLARATION_COMMENT_KEY]);

/** fieldGroups の 1 項目の鍵(管理画面フォームのセクション) */
export const FIELD_GROUP_KEYS = new Set(["key", "label", "fields", "collapsible", "defaultCollapsed", "bgColor", DECLARATION_COMMENT_KEY]);

/**
 * 項目の列の形 fields[].column(fieldType の既定と違う時だけ)
 * - name: 列の物理名 / type: SQL の型の書き方(smallint・numeric・inet・uuid[] …、照らしは drizzle の getSQLType と比べる)
 * - enum: enums[] の名前 / default: JSON の値か { sql: "<式>" } / notNull / identity: "always" | "byDefault"
 * - unique: 列の制約(.unique()。項目の unique と違い、ソフトデリートの表でも部分索引にしない)
 */
export const COLUMN_KEYS = new Set(["name", "type", "enum", "default", "notNull", "identity", "unique", DECLARATION_COMMENT_KEY]);
/** 表だけの列(columns[])の鍵 */
export const TABLE_COLUMN_KEYS = new Set(["name", "column", DECLARATION_COMMENT_KEY]);
export const IDENTITY_VALUES = new Set(["always", "byDefault"]);

/** 索引(indexes[])の鍵: 今の fields・where・name・using・opclass + unique・desc(降順の列)・expression(列の代わりの SQL の式) */
export const INDEX_KEYS = new Set(["fields", "where", "name", "using", "opclass", "unique", "desc", "expression", DECLARATION_COMMENT_KEY]);

export const PRIMARY_KEY_KEYS = new Set(["columns", "name", DECLARATION_COMMENT_KEY]);
export const FOREIGN_KEY_KEYS = new Set(["columns", "references", "onDelete", "onUpdate", "name", DECLARATION_COMMENT_KEY]);
export const FOREIGN_KEY_REFERENCE_KEYS = new Set(["table", "columns", DECLARATION_COMMENT_KEY]);
export const CHECK_KEYS = new Set(["name", "sql", DECLARATION_COMMENT_KEY]);
export const ENUM_KEYS = new Set(["name", "values", "valuesFrom", DECLARATION_COMMENT_KEY]);
export const VALUES_FROM_KEYS = new Set(["file", "export", DECLARATION_COMMENT_KEY]);
export const DB_OBJECT_KEYS = new Set(["kind", "file", DECLARATION_COMMENT_KEY]);
export const DB_OBJECT_KINDS = new Set(["trigger", "function"]);
export const SERVICE_KEYS = new Set(["file", "export", DECLARATION_COMMENT_KEY]);

/**
 * entity.json の入れ子の鍵の表(readDomain が歩く): 鍵 → { 中の鍵の集合, 配列か, さらに入れ子 }
 * @typedef {{ keys: Set<string>, list: boolean, nested?: Record<string, NestedKeys> }} NestedKeys
 * @type {Record<string, NestedKeys>}
 */
export const ENTITY_NESTED_KEYS = {
  fields: { keys: FIELD_KEYS, list: true, nested: { collection: { keys: COLLECTION_KEYS, list: false }, column: { keys: COLUMN_KEYS, list: false } } },
  columns: { keys: TABLE_COLUMN_KEYS, list: true, nested: { column: { keys: COLUMN_KEYS, list: false } } },
  relations: { keys: RELATION_KEYS, list: true },
  fieldGroups: { keys: FIELD_GROUP_KEYS, list: true },
  indexes: { keys: INDEX_KEYS, list: true },
  primaryKey: { keys: PRIMARY_KEY_KEYS, list: false },
  foreignKeys: { keys: FOREIGN_KEY_KEYS, list: true, nested: { references: { keys: FOREIGN_KEY_REFERENCE_KEYS, list: false } } },
  checks: { keys: CHECK_KEYS, list: true },
  enums: { keys: ENUM_KEYS, list: true, nested: { valuesFrom: { keys: VALUES_FROM_KEYS, list: false } } },
  dbObjects: { keys: DB_OBJECT_KEYS, list: true },
  service: { keys: SERVICE_KEYS, list: false },
};
