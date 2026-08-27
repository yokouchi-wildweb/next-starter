// src/features/core/fingerprintChallenge/entities/schema.ts

import { z } from "zod";

import { FINGERPRINT_CHALLENGE_STATUSES } from "@/features/core/fingerprintChallenge/constants";
import { DeviceFingerprintIngestSchema } from "@/features/core/deviceFingerprint/entities/schema";

/**
 * CRUD ベース (drizzleBase) の create バリデーション。
 * 主経路は issueChallenge (トークン生成込み) であり、汎用 create の直接利用は想定しない。
 */
export const FingerprintChallengeCreateSchema = z.object({
  userId: z.string().uuid(),
  tokenHash: z.string().min(1).max(128),
  status: z.enum(FINGERPRINT_CHALLENGE_STATUSES).optional(),
  prompt: z.unknown().optional(),
  issuedBy: z.string().uuid().nullable().optional(),
  expiresAt: z.date(),
});

export type FingerprintChallengeCreateInput = z.infer<typeof FingerprintChallengeCreateSchema>;

/** CRUD ベースの update バリデーション (wrapper からの状態遷移で使用) */
export const FingerprintChallengeUpdateSchema = z.object({
  status: z.enum(FINGERPRINT_CHALLENGE_STATUSES).optional(),
  answers: z.unknown().optional(),
  behavior: z.unknown().nullable().optional(),
  fingerprintId: z.string().uuid().nullable().optional(),
  submittedAt: z.date().nullable().optional(),
  reviewedAt: z.date().nullable().optional(),
  reviewedBy: z.string().uuid().nullable().optional(),
  reviewNote: z.string().max(4000).nullable().optional(),
  updatedAt: z.date().optional(),
});

export type FingerprintChallengeUpdateInput = z.infer<typeof FingerprintChallengeUpdateSchema>;

/**
 * CRUD ベースの Insert 型パラメータ。create / update 双方で書き込む列の和集合。
 * createCrudService は Insert = このジェネリックを create の引数型と update の
 * Partial<Insert> の双方に使うため、update 専用列 (answers 等) もここに含める。
 * 実際のバリデーションは parseCreate / parseUpdate が個別に担う。
 */
export type FingerprintChallengeWriteInput = FingerprintChallengeCreateInput &
  Partial<FingerprintChallengeUpdateInput>;

/** 管理者によるチャレンジ発行 API (POST /api/admin/fingerprint-challenges) の入力 */
export const IssueChallengeSchema = z.object({
  userId: z.string().uuid(),
  /** 質問・文言。downstream のフォーム画面が解釈する自由形式 (上限 16KB 相当) */
  prompt: z.unknown().optional(),
  /** 省略時は FINGERPRINT_CONFIG.challenge.defaultExpiresInDays */
  expiresInDays: z.number().int().positive().max(365).optional(),
});

export type IssueChallengeInput = z.infer<typeof IssueChallengeSchema>;

/** ユーザーによる回答提出 API (POST /api/me/fingerprint-challenges/[token]/submit) の入力 */
export const SubmitChallengeSchema = z.object({
  /** 回答本体 (自由形式。フォームスキーマは downstream 所有) */
  answers: z.unknown(),
  /** デバイスフィンガープリント (必須添付) */
  fingerprint: DeviceFingerprintIngestSchema,
  /** useBehavioralCapture の行動計測 payload (取得できなかった場合は省略可) */
  behavior: z.unknown().optional(),
});

export type SubmitChallengeInput = z.infer<typeof SubmitChallengeSchema>;
