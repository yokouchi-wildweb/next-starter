// src/domains/core/fingerprintChallenge/constants/domain.ts
// どの表にも属さないドメイン全体の定数と入力の形(entities/<登録名>/ にはその表の物だけ)

import { DeviceFingerprintIngestSchema } from "@/domains/core/deviceFingerprint/entities/schema";
import { z } from "zod";

/** 管理者による通知スタンプ (PATCH action "mark_notified") の入力 */
export const MarkChallengeNotifiedSchema = z.object({
  /** 案内に使ったチャネル (例: ["email"]。語彙は downstream 自由)。既存と和集合で保存 */
  channels: z.array(z.string().min(1).max(32)).min(1).max(16),
  /** 送信時刻。省略時は now */
  notifiedAt: z.coerce.date().optional(),
  note: z.string().max(4000).nullable().optional(),
});
/** 管理者によるチャレンジ発行 API (POST /api/admin/fingerprint-challenges) の入力 */
export const IssueChallengeSchema = z.object({
  userId: z.string().uuid(),
  /** 質問・文言。downstream のフォーム画面が解釈する自由形式 (上限 16KB 相当) */
  prompt: z.unknown().optional(),
  /** 省略時は fingerprintChallengeConfig.challenge.defaultExpiresInDays */
  expiresInDays: z.number().int().positive().max(365).optional(),
});
/** ユーザーによる回答提出 API (POST /api/me/fingerprint-challenges/[token]/submit) の入力 */
export const SubmitChallengeSchema = z.object({
  /** 回答本体 (自由形式。フォームスキーマは downstream 所有) */
  answers: z.unknown(),
  /** デバイスフィンガープリント (必須添付) */
  fingerprint: DeviceFingerprintIngestSchema,
  /** useBehavioralCapture の行動計測 payload (取得できなかった場合は省略可) */
  behavior: z.unknown().optional(),
});
