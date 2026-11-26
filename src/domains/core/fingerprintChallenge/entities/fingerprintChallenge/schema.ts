// src/domains/core/fingerprintChallenge/entities/fingerprintChallenge/schema.ts

import { FINGERPRINT_CHALLENGE_STATUSES } from "@/domains/core/fingerprintChallenge/constants";
import { z } from "zod";

/**
 * CRUD ベース (fingerprintChallengeBase) の create バリデーション。
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
  notifiedAt: z.date().nullable().optional(),
  notifiedChannels: z.array(z.string().min(1).max(32)).max(16).optional(),
  // first/last_viewed_at / view_count は accessLog の raw SQL (atomic increment) でのみ更新し、
  // parseUpdate 経路には載せない
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
