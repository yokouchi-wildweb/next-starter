// src/features/core/userLoginEvent/services/server/recordLoginEvent.ts

import { db } from "@/lib/drizzle";
import { getAuditContext } from "@/lib/audit";

import { UserLoginEventTable } from "@/features/core/userLoginEvent/entities/drizzle";
import {
  DEFAULT_LOGIN_EVENT_RETENTION_DAYS,
  type UserLoginEventType,
} from "@/features/core/userLoginEvent/constants";

export type RecordLoginEventInput = {
  userId: string;
  eventType: UserLoginEventType;
  /**
   * クライアント IP。null / undefined / 空文字なら記録をスキップする。
   * 省略時は ALS context (`getAuditContext().ip`) からフォールバック取得する。
   */
  ip?: string | null | undefined;
  /**
   * クライアント User-Agent。省略時は ALS context からフォールバック取得する。
   * 明示的に null を渡せば「記録しない」とみなす。
   */
  userAgent?: string | null;
  /** 省略時は now */
  occurredAt?: Date;
  /** 省略時は DEFAULT_LOGIN_EVENT_RETENTION_DAYS */
  retentionDays?: number;
};

/**
 * ログイン / サインアップ成功を user_login_events に記録する。
 *
 * 設計上の取り決め:
 * - bestEffort: 書き込み失敗は呼び出し元のフロー (ログイン / 登録) を阻害しない。
 *   失敗時は console.error にログ出力するのみ (dead-letter は持たない。
 *   重要度は audit_logs より低く、欠損しても監査整合性は壊れないため)。
 * - IP が無いケース (オフライン / システム経路) は黙ってスキップする。
 *   本テーブルの主用途は IP 集計のため、IP 無し行を入れる意義が無い。
 */
export async function recordLoginEvent(input: RecordLoginEventInput): Promise<void> {
  const alsContext = getAuditContext();
  const ip = (input.ip ?? alsContext?.ip ?? "").trim();
  if (!ip) return;

  const userAgent =
    input.userAgent !== undefined ? input.userAgent : alsContext?.userAgent ?? null;

  try {
    await db.insert(UserLoginEventTable).values({
      userId: input.userId,
      eventType: input.eventType,
      ip,
      userAgent,
      occurredAt: input.occurredAt ?? new Date(),
      retentionDays: input.retentionDays ?? DEFAULT_LOGIN_EVENT_RETENTION_DAYS,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify({
        level: "error",
        scope: "user-login-event",
        op: "recordLoginEvent",
        userId: input.userId,
        eventType: input.eventType,
        error: message,
      }),
    );
  }
}
