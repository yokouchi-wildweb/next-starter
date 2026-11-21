// src/lib/domain/server.ts
// 入口 "./server"(@/lib/domain/server): サーバー専用のドメインユーティリティ（server-only）
// クライアントコンポーネントからはインポートしないでください。名前は 1 つずつ書く(index.ts と同じ理由)

// junction: 中間テーブル取得（server-only）
export { getJunctionTable, getJunctionTableOrThrow, type JunctionTables } from "./junction/getTable";

// service/server: サービス取得・ドメイン一覧・表の引き当て
export { getService, getServiceOrThrow, hasService, lookupDomainService } from "./service/server/getService";
export {
  getDomainList,
  getDomainListWithCount,
  getInvalidDomainKeys,
  isValidDomainKey,
  withRecordCounts,
  type DomainLabelMap,
} from "./service/server/getDomainList";
export { findDomainByTable, getDomainTable, type DomainTable } from "./service/server/tableLookup";
