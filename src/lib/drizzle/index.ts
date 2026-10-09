// src/lib/drizzle/index.ts

import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from '@/registry/schemaRegistry';

type Database = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  queryClient: ReturnType<typeof postgres> | undefined;
};

/**
 * DATABASE_URL が設定済み（trim 後に非空）かどうか。
 *
 * `pnpm env:init` 直後の .env.development は `DATABASE_URL=''` のまま（= 未設定）。
 * この状態でも dev サーバーが起動しトップページが表示できることを手順書で約束しているため、
 * DB を必須としない読み取り経路（settingService.getGlobalSetting 等）はこの判定で
 * 「DB 未構成モード」に分岐する。
 *
 * NOTE: 判定は「未設定」のみ。設定済みで接続できない場合は従来どおり例外になる
 * （本番の DB 障害を黙って既定値で覆い隠さないため）。
 */
export const isDatabaseConfigured = (): boolean =>
  (process.env.DATABASE_URL ?? "").trim().length > 0;

/**
 * DATABASE_URL 未設定の状態で DB にアクセスした時に投げられるエラー。
 * postgres クライアントに空文字を渡すと localhost:5432 への接続を試みて
 * CONNECT_TIMEOUT まで（約 30 秒）待たされるため、代わりに即座にこのエラーで失敗させる。
 */
export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "DATABASE_URL が未設定です。.env.development に Neon 等の接続文字列を設定し、" +
        "pnpm db:push でスキーマを適用してください。",
    );
    this.name = "DatabaseNotConfiguredError";
  }
}

/**
 * 未設定時の `db` 代替。どのプロパティに触れても DatabaseNotConfiguredError を投げる。
 * import 時点では評価されない（lazy）ので、db を import するだけのモジュールは読み込める。
 */
function createUnconfiguredDb(): Database {
  return new Proxy({} as Database, {
    get(_target, prop) {
      // `await db` / ログ出力などで暗黙に参照される可能性のあるキーだけは素通しする
      if (prop === "then" || typeof prop === "symbol") return undefined;
      throw new DatabaseNotConfiguredError();
    },
  });
}

function createConfiguredDb(): Database {
  const queryClient =
    globalForDb.queryClient ?? postgres(process.env.DATABASE_URL!, { prepare: false, max: 3 });

  if (process.env.NODE_ENV !== "production") {
    globalForDb.queryClient = queryClient;
  }

  return drizzle(queryClient, { schema });
}

export const db: Database = isDatabaseConfigured() ? createConfiguredDb() : createUnconfiguredDb();
