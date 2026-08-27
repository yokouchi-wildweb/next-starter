// src/features/core/deviceFingerprint/services/server/similarity.ts
//
// デバイスフィンガープリントの類似照合クエリ。すべて server-only。
//
// スコアリング: 成分別の重み付き一致数 (FINGERPRINT_COMPONENT_WEIGHTS、満点 15)。
// ブラウザ更新や設定変更で一部成分は変わるため「合成ハッシュの完全一致」ではなく
// 成分ごとの一致を数える。JOIN は index のある強成分 (canvas / audio / webgl / fonts)
// の一致を必須条件にしている = 弱成分のみの一致 (score <= 5 相当) は候補に上がらない。
//
// 結果は「参考証拠」。信号はクライアント申告値で偽装可能であり、同型端末
// (特に iPhone) はユーザー間で衝突し得る。単独での断定材料にしないこと。

import { sql } from "drizzle-orm";

import { db } from "@/lib/drizzle";

import { DeviceFingerprintTable } from "@/features/core/deviceFingerprint/entities/drizzle";
import { UserTable } from "@/features/core/user/entities/drizzle";
import {
  DEFAULT_SIMILARITY_MIN_SCORE,
  FINGERPRINT_COMPONENT_WEIGHTS,
} from "@/features/core/deviceFingerprint/constants";

const T = DeviceFingerprintTable;
const W = FINGERPRINT_COMPONENT_WEIGHTS;

/** a.<col> と b.<col> の重み付き一致スコア式を組み立てる (a / b はエイリアス前提の生 SQL) */
const scoreExpr = sql`
    (CASE WHEN a.canvas_hash   IS NOT NULL AND a.canvas_hash   = b.canvas_hash   THEN ${W.canvas}::int   ELSE 0 END)
  + (CASE WHEN a.audio_hash    IS NOT NULL AND a.audio_hash    = b.audio_hash    THEN ${W.audio}::int    ELSE 0 END)
  + (CASE WHEN a.webgl_hash    IS NOT NULL AND a.webgl_hash    = b.webgl_hash    THEN ${W.webgl}::int    ELSE 0 END)
  + (CASE WHEN a.fonts_hash    IS NOT NULL AND a.fonts_hash    = b.fonts_hash    THEN ${W.fonts}::int    ELSE 0 END)
  + (CASE WHEN a.screen_key    IS NOT NULL AND a.screen_key    = b.screen_key    THEN ${W.screen}::int   ELSE 0 END)
  + (CASE WHEN a.timezone      IS NOT NULL AND a.timezone      = b.timezone      THEN ${W.timezone}::int ELSE 0 END)
  + (CASE WHEN a.languages     IS NOT NULL AND a.languages     = b.languages     THEN ${W.languages}::int ELSE 0 END)
  + (CASE WHEN a.platform      IS NOT NULL AND a.platform      = b.platform      THEN ${W.platform}::int ELSE 0 END)
  + (CASE WHEN a.hardware_key  IS NOT NULL AND a.hardware_key  = b.hardware_key  THEN ${W.hardware}::int ELSE 0 END)
`;

/** 強成分 (index あり) の一致を JOIN 条件にする。弱成分のみの一致は候補にしない */
const strongMatchJoin = sql`
    (a.canvas_hash IS NOT NULL AND b.canvas_hash = a.canvas_hash)
 OR (a.audio_hash  IS NOT NULL AND b.audio_hash  = a.audio_hash)
 OR (a.webgl_hash  IS NOT NULL AND b.webgl_hash  = a.webgl_hash)
 OR (a.fonts_hash  IS NOT NULL AND b.fonts_hash  = a.fonts_hash)
`;

export type SimilarFingerprintUserRow = {
  userId: string;
  /** 最も類似したフィンガープリントペアの重み付きスコア (満点 15) */
  bestScore: number;
  /** スコア条件を満たした相手側フィンガープリント行数 */
  matchedFingerprints: number;
  lastSeenAt: Date;
};

export type FindUsersBySimilarFingerprintOptions = {
  /** 既定 DEFAULT_SIMILARITY_MIN_SCORE (= 5) */
  minScore?: number;
  /** 既定 50 */
  limit?: number;
  /** デモユーザーを除外するか。既定 true */
  excludeDemo?: boolean;
};

/**
 * 指定ユーザーのフィンガープリント群と類似するデバイスを持つ他ユーザーを検索する。
 * userLoginEvent の findUsersBySameIp (IP 軸) と組で使う想定。
 */
export async function findUsersBySimilarFingerprint(
  userId: string,
  options: FindUsersBySimilarFingerprintOptions = {},
): Promise<SimilarFingerprintUserRow[]> {
  const minScore = options.minScore ?? DEFAULT_SIMILARITY_MIN_SCORE;
  const limit = options.limit ?? 50;
  const excludeDemo = options.excludeDemo ?? true;

  const rows = (await db.execute(sql`
    WITH pairs AS (
      SELECT
        b.user_id AS matched_user_id,
        b.id AS fingerprint_id,
        b.last_seen_at,
        (${scoreExpr}) AS score
      FROM ${T} a
      JOIN ${T} b
        ON b.user_id <> a.user_id
       AND (${strongMatchJoin})
      WHERE a.user_id = ${userId}::uuid
    )
    SELECT
      p.matched_user_id AS "userId",
      MAX(p.score)::int AS "bestScore",
      COUNT(DISTINCT p.fingerprint_id)::int AS "matchedFingerprints",
      MAX(p.last_seen_at) AS "lastSeenAt"
    FROM pairs p
    JOIN ${UserTable} u ON u.id = p.matched_user_id
    WHERE (${excludeDemo}::boolean = false OR u.is_demo = false)
    GROUP BY p.matched_user_id
    HAVING MAX(p.score) >= ${minScore}
    ORDER BY "bestScore" DESC, "lastSeenAt" DESC
    LIMIT ${limit}
  `)) as Array<{
    userId: string;
    bestScore: number;
    matchedFingerprints: number;
    lastSeenAt: Date | string;
  }>;

  return rows.map((row) => ({
    ...row,
    lastSeenAt: row.lastSeenAt instanceof Date ? row.lastSeenAt : new Date(row.lastSeenAt),
  }));
}

export type FingerprintPairComparison = {
  fingerprintIdA: string;
  fingerprintIdB: string;
  score: number;
  /** 成分別の一致内訳 (null 成分同士は不一致扱い) */
  matches: {
    canvas: boolean;
    audio: boolean;
    webgl: boolean;
    fonts: boolean;
    screen: boolean;
    timezone: boolean;
    languages: boolean;
    platform: boolean;
    hardware: boolean;
  };
};

/**
 * 2 ユーザー間のフィンガープリントを総当たり比較し、スコア上位ペアの
 * 成分別一致内訳を返す (admin のドリルダウン調査用)。
 */
export async function compareUsersFingerprints(
  userIdA: string,
  userIdB: string,
  options: { limit?: number } = {},
): Promise<FingerprintPairComparison[]> {
  const limit = options.limit ?? 5;

  const rows = (await db.execute(sql`
    SELECT
      a.id AS "fingerprintIdA",
      b.id AS "fingerprintIdB",
      (${scoreExpr})::int AS "score",
      (a.canvas_hash  IS NOT NULL AND a.canvas_hash  = b.canvas_hash)  AS "canvas",
      (a.audio_hash   IS NOT NULL AND a.audio_hash   = b.audio_hash)   AS "audio",
      (a.webgl_hash   IS NOT NULL AND a.webgl_hash   = b.webgl_hash)   AS "webgl",
      (a.fonts_hash   IS NOT NULL AND a.fonts_hash   = b.fonts_hash)   AS "fonts",
      (a.screen_key   IS NOT NULL AND a.screen_key   = b.screen_key)   AS "screen",
      (a.timezone     IS NOT NULL AND a.timezone     = b.timezone)     AS "timezone",
      (a.languages    IS NOT NULL AND a.languages    = b.languages)    AS "languages",
      (a.platform     IS NOT NULL AND a.platform     = b.platform)     AS "platform",
      (a.hardware_key IS NOT NULL AND a.hardware_key = b.hardware_key) AS "hardware"
    FROM ${T} a
    CROSS JOIN ${T} b
    WHERE a.user_id = ${userIdA}::uuid
      AND b.user_id = ${userIdB}::uuid
    ORDER BY "score" DESC
    LIMIT ${limit}
  `)) as Array<
    { fingerprintIdA: string; fingerprintIdB: string; score: number } & Record<string, boolean>
  >;

  return rows.map((row) => ({
    fingerprintIdA: row.fingerprintIdA,
    fingerprintIdB: row.fingerprintIdB,
    score: row.score,
    matches: {
      canvas: row.canvas === true,
      audio: row.audio === true,
      webgl: row.webgl === true,
      fonts: row.fonts === true,
      screen: row.screen === true,
      timezone: row.timezone === true,
      languages: row.languages === true,
      platform: row.platform === true,
      hardware: row.hardware === true,
    },
  }));
}

export type ExactFingerprintUserRow = {
  userId: string;
  seenCount: number;
  lastSeenAt: Date;
};

export type FindUsersByExactFingerprintOptions = {
  /** 自分自身を除外したい場合に指定 */
  excludeUserId?: string;
  /** 既定 100 */
  limit?: number;
};

/**
 * 合成ハッシュ完全一致のユーザー一覧 (最も強い一致。ノイズ注入ブラウザでは出にくい)。
 */
export async function findUsersByExactFingerprint(
  compositeHash: string,
  options: FindUsersByExactFingerprintOptions = {},
): Promise<ExactFingerprintUserRow[]> {
  const limit = options.limit ?? 100;
  const excludeUserId = options.excludeUserId ?? null;

  const rows = (await db.execute(sql`
    SELECT
      ${T.userId} AS "userId",
      SUM(${T.seenCount})::int AS "seenCount",
      MAX(${T.lastSeenAt}) AS "lastSeenAt"
    FROM ${T}
    WHERE ${T.compositeHash} = ${compositeHash}
      AND (${excludeUserId}::uuid IS NULL OR ${T.userId} <> ${excludeUserId}::uuid)
    GROUP BY ${T.userId}
    ORDER BY "lastSeenAt" DESC
    LIMIT ${limit}
  `)) as Array<{ userId: string; seenCount: number; lastSeenAt: Date | string }>;

  return rows.map((row) => ({
    ...row,
    lastSeenAt: row.lastSeenAt instanceof Date ? row.lastSeenAt : new Date(row.lastSeenAt),
  }));
}
