// src/lib/dataMigration/serviceResolver.ts
//
// dataMigration がドメイン名からサービスを引く口。lib は登録表（serviceRegistry）を import しないので、
// API ルートが src/wiring/domains.ts の getService を注入する（ファイル台帳の DataMigrationMediaResolver と同じ形）。
// 認可（domainEntry.ts の access の export / import）はルートが評価してから呼ぶ。lib は再評価しない。

import type { PgTable } from "drizzle-orm/pg-core";

import type { DomainService } from "@/lib/domain/types";

/** ドメインキー（camelCase）からサービスを引く。未登録なら undefined、読み込み失敗は throw */
export type DataMigrationServiceResolver = (key: string) => Promise<DomainService | undefined>;

/** 中間表の名前（snake_case）から表を引く。未登録なら undefined（API ルートが src/wiring/domains.ts の getJunctionTable を注入する） */
export type DataMigrationJunctionResolver = (tableName: string) => Promise<PgTable | undefined>;
