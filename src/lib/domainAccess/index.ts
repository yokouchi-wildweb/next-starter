// src/lib/domainAccess/index.ts
// 入口 ".": 汎用ドメイン API と管理データ操作の権限の型・操作名・定型(プリセット)。値だけのファイルだけで作る
// (登録表と上書き entity.override.ts が値で読む。pnpm check registry が読み込み先を値だけか確かめる: 関数・hooks を置かない)。
// 名前は 1 つずつ書く(export * にしない: tsx でテストが入口を読むとき名前が見えなくなる)

export {
  DATA_COMMANDS,
  DOMAIN_API_OPERATIONS,
  DOMAIN_CRUD_OPERATIONS,
  DOMAIN_DATA_OPERATIONS,
  type DataCommand,
  type DataCommandOverride,
  type DomainApiAccessConfig,
  type DomainApiAccessRule,
  type DomainApiOperation,
  type DomainApiRoleRule,
  type DomainCrudOperation,
  type DomainDataOperation,
} from "./apiAccess";
export {
  ADMIN_DATA_OPERATIONS,
  ADMIN_ONLY,
  ADMIN_OR_DEBUGGER,
  ADMIN_OR_DEBUGGER_RULE,
  ADMIN_RULE,
  DEFAULT_ACCESS_RULE,
  INTERNAL_ONLY,
  PUBLIC_READ,
} from "./accessPresets";
