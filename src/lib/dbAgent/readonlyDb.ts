// src/lib/dbAgent/readonlyDb.ts
//
// DB調査エージェント専用の「読取専用」Postgres 接続。
//
// fail-closed 設計:
// - DATABASE_URL_READONLY (読取専用ロールの接続文字列) が未設定なら機能自体が無効。
//   通常の DATABASE_URL への自動フォールバックは絶対にしない (write 可能な接続に
//   エージェントが到達するコードパスを構造的に作らないため)。
// - 挙動トグル用の env は増やさない方針のため、「シークレットの有無」がそのまま
//   有効/無効のゲートになる。
//
// 読取専用ロールの作成手順は README.md を参照。

import "server-only";

import postgres from "postgres";

import { DB_AGENT_CONFIG } from "@/config/app/ai-agent.config";
import { DomainError } from "@/lib/errors";

const globalForDbAgent = globalThis as unknown as {
  dbAgentReadonlyClient: ReturnType<typeof postgres> | undefined;
};

/** DB調査エージェントが利用可能か (読取専用接続が構成されているか) */
export function isDbAgentEnabled(): boolean {
  return Boolean(process.env.DATABASE_URL_READONLY);
}

/**
 * 読取専用接続を取得する。未構成なら 503 DomainError。
 *
 * statement_timeout を接続パラメータで適用し、暴走クエリを DB 側でも打ち切る
 * (アプリ層の SELECT 検証と合わせた多層防御)。
 */
export function getReadonlyDb(): ReturnType<typeof postgres> {
  const url = process.env.DATABASE_URL_READONLY;
  if (!url) {
    throw new DomainError(
      "DB調査エージェントは無効です。DATABASE_URL_READONLY を構成してください。",
      { status: 503 },
    );
  }

  if (!globalForDbAgent.dbAgentReadonlyClient) {
    globalForDbAgent.dbAgentReadonlyClient = postgres(url, {
      prepare: false,
      max: 2,
      connection: {
        statement_timeout: DB_AGENT_CONFIG.statementTimeoutMs,
        // 読取専用ロール前提だが、セッションレベルでも二重に read only を強制する
        default_transaction_read_only: true,
      },
    });
  }

  return globalForDbAgent.dbAgentReadonlyClient;
}
