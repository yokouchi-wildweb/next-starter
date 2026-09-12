// src/features/core/fingerprintChallenge/services/server/accessLog.ts
//
// 「ユーザーがチャレンジを開いたか」の計測 (アクセスログ)。
// 本人向け取得ルートの読み取り経路 (getChallengeForUser / getPendingChallengeForUser) から
// 呼ばれ、親行のカウンタ更新 + アクセスイベント追記を行う。
//
// 設計上の取り決め:
// - FINGERPRINT_CONFIG.challenge.accessLog.enabled が false なら何もしない (既定・オプトイン)。
// - fail-soft: 記録失敗は console.error のみで、読み取り本体を阻害しない
//   (userLoginEvent.recordLoginEvent と同じ方針。監査整合性に関わるデータではない)。
// - 追加 SELECT なし: dedupe 判定は UPDATE の WHERE 句 + RETURNING で行う
//   (更新 0 行 = 窓内の再アクセス → イベント追記もスキップ)。
// - IP / UA は routeFactory が ALS に注入した監査コンテキストから取る (route 側の配線不要)。

import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import { getAuditContext } from "@/lib/audit";
import { FINGERPRINT_CONFIG } from "@/config/app/fingerprint.config";

import {
  FingerprintChallengeAccessEventTable,
  FingerprintChallengeTable,
} from "@/features/core/fingerprintChallenge/entities/drizzle";
import type { FingerprintChallengeAccessEvent } from "@/features/core/fingerprintChallenge/entities/model";

export type RecordChallengeViewInput = {
  challengeId: string;
  userId: string;
  /** 省略時は ALS 監査コンテキストから取得。null 明示で「記録しない」 */
  ip?: string | null;
  /** 省略時は ALS 監査コンテキストから取得。null 明示で「記録しない」 */
  userAgent?: string | null;
};

/**
 * チャレンジ閲覧を 1 回分記録する。
 *
 * 1. UPDATE fingerprint_challenges: first_viewed_at (初回のみ) / last_viewed_at / view_count+1。
 *    WHERE で dedupe 窓 (last_viewed_at が dedupeSeconds 以内なら対象外) と
 *    status = 'pending' (提出後・取り下げ後の再閲覧はカウントしない) を判定。
 * 2. 更新できた場合のみ fingerprint_challenge_access_events に 1 行追記。
 *
 * 呼び出し元は await してよい (1 UPDATE + 1 INSERT の軽量処理) が、失敗は投げない。
 */
export async function recordChallengeView(input: RecordChallengeViewInput): Promise<void> {
  const config = FINGERPRINT_CONFIG.challenge.accessLog;
  if (!config.enabled) return;

  const alsContext = getAuditContext();
  const ipRaw = input.ip !== undefined ? input.ip : alsContext?.ip ?? null;
  const ip = ipRaw?.trim() ? ipRaw.trim() : null;
  const userAgent =
    input.userAgent !== undefined ? input.userAgent : alsContext?.userAgent ?? null;

  try {
    const dedupeSeconds = Math.max(0, config.dedupeSeconds);
    const touched = await db
      .update(FingerprintChallengeTable)
      .set({
        firstViewedAt: sql`COALESCE(${FingerprintChallengeTable.firstViewedAt}, NOW())`,
        lastViewedAt: sql`NOW()`,
        viewCount: sql`${FingerprintChallengeTable.viewCount} + 1`,
      })
      .where(
        and(
          eq(FingerprintChallengeTable.id, input.challengeId),
          eq(FingerprintChallengeTable.userId, input.userId),
          eq(FingerprintChallengeTable.status, "pending"),
          sql`(${FingerprintChallengeTable.lastViewedAt} IS NULL OR ${FingerprintChallengeTable.lastViewedAt} < NOW() - make_interval(secs => ${dedupeSeconds}))`,
        ),
      )
      .returning({ id: FingerprintChallengeTable.id });

    if (touched.length === 0) return; // dedupe 窓内 / pending 以外 → 記録しない

    await db.insert(FingerprintChallengeAccessEventTable).values({
      challengeId: input.challengeId,
      userId: input.userId,
      ip,
      userAgent,
      retentionDays: config.retentionDays,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify({
        level: "error",
        scope: "fingerprint-challenge",
        op: "recordChallengeView",
        challengeId: input.challengeId,
        userId: input.userId,
        error: message,
      }),
    );
  }
}

export type ListChallengeAccessEventsParams = {
  challengeId: string;
  /** 1 始まり。既定 1 */
  page?: number;
  /** 既定 50、上限 200 */
  limit?: number;
};

export type ListChallengeAccessEventsResult = {
  results: FingerprintChallengeAccessEvent[];
  total: number;
  page: number;
  limit: number;
};

const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;

/**
 * チャレンジ別のアクセスイベントを新しい順にページネーションで返す (admin 専用。IP を含む)。
 * チャレンジの存在確認は呼び出し側 (admin ルート) で行う。
 */
export async function listChallengeAccessEvents(
  params: ListChallengeAccessEventsParams,
): Promise<ListChallengeAccessEventsResult> {
  const page = Math.max(1, Math.floor(params.page ?? 1));
  const limit = Math.min(MAX_LIST_LIMIT, Math.max(1, Math.floor(params.limit ?? DEFAULT_LIST_LIMIT)));
  const where = eq(FingerprintChallengeAccessEventTable.challengeId, params.challengeId);

  const [rows, countRows] = await Promise.all([
    db
      .select()
      .from(FingerprintChallengeAccessEventTable)
      .where(where)
      .orderBy(desc(FingerprintChallengeAccessEventTable.accessedAt))
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(FingerprintChallengeAccessEventTable)
      .where(where),
  ]);

  return {
    results: rows as FingerprintChallengeAccessEvent[],
    total: countRows[0]?.total ?? 0,
    page,
    limit,
  };
}
