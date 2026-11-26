// src/lib/domain/definition/declaration.mjs
// ドメインの宣言の形(D335): ドメインそのものの短い宣言 src/domains/<d>/domain.json と、表 1 つ = 登録 1 件ごとの宣言
// src/domains/<d>/entities/<登録名>/entity.json。登録の一覧はフォルダの並びで、どこにも手で書かない。読むのは ./readDomain.mjs だけ。
// 鍵の集合の正はこのファイル。素の node で読めるよう JS だけ(入口 "./node")

/** ドメインの宣言のファイル名(ドメインのフォルダの直下) */
export const DOMAIN_DECLARATION_FILE = "domain.json";
/** 登録の宣言のフォルダ(ドメインのフォルダの直下)。その下のフォルダ 1 つ = 登録 1 件、フォルダ名 = 登録名 */
export const ENTITIES_DIR = "entities";
/** 登録の宣言のファイル名(entities/<登録名>/ の直下) */
export const ENTITY_DECLARATION_FILE = "entity.json";

/** この形の版(domain.json の domainConfigVersion)。今の 1 ファイルの形は "1.x" */
export const DOMAIN_DECLARATION_VERSION = "2.0";

/** 開発者のメモの鍵(JSON Schema の注記と同じ名前)。どの宣言にも書け、道具は読まない */
export const DECLARATION_COMMENT_KEY = "$comment";

/**
 * domain.json の鍵(ドメインそのもの。表の事実は持たない)
 * - domainConfigVersion: この形の版(DOMAIN_DECLARATION_VERSION)
 * - label: ドメインの表示名(管理の一覧・データ操作の一覧)
 */
export const DOMAIN_KEYS = new Set(["domainConfigVersion", "label", DECLARATION_COMMENT_KEY]);

/**
 * entity.json の鍵のうち、表の形と汎用の一式の鍵(今の 1 ファイルの domain.json の表の鍵と同じ意味)
 * 細かい値の語彙(fields・relations の中の鍵)は今の検査 scripts/structure/domain/spec/domainJson.mjs のまま(付け替えは後の指令)
 */
export const ENTITY_TABLE_KEYS = new Set([
  "singular", "plural", "label", "dbEngine", "idType", "relations", "useCreatedAt", "useUpdatedAt",
  "useSoftDelete", "sortOrderField", "fields", "fieldGroups", "searchFields", "searchRank", "defaultOrderBy", "tableFields",
  "useDetailModal", "addToAdminDataMenu", "useDuplicateButton", "useImportExport", "useAutoSave", "compositeUniques", "indexes",
  "systemColumns", "hiddenColumns", "apiAccess", "audit", "cache",
]);

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
