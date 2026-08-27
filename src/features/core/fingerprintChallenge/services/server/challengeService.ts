// src/features/core/fingerprintChallenge/services/server/challengeService.ts
//
// チャレンジのライフサイクル操作 (発行 → 回答提出 → レビュー / 取り下げ)。
// すべて server-only。HTTP からの入口は
//   - 発行 / レビュー / 取り下げ: /api/admin/fingerprint-challenges/**
//   - 回答取得 / 提出: /api/me/fingerprint-challenges/[token]/** (本人 + トークン二重検証)

import { createHash, randomBytes } from "node:crypto";

import { eq } from "drizzle-orm";

import { db } from "@/lib/drizzle";
import { DomainError } from "@/lib/errors";
import { auditLogger } from "@/features/core/auditLog/services/server";
import { FINGERPRINT_CONFIG } from "@/config/app/fingerprint.config";

import { recordDeviceFingerprint } from "@/features/core/deviceFingerprint/services/server";
import { FingerprintChallengeTable } from "@/features/core/fingerprintChallenge/entities/drizzle";
import {
  SubmitChallengeSchema,
  type IssueChallengeInput,
} from "@/features/core/fingerprintChallenge/entities/schema";
import type {
  FingerprintChallenge,
  FingerprintChallengeForUser,
} from "@/features/core/fingerprintChallenge/entities/model";
import type { EffectiveChallengeStatus } from "@/features/core/fingerprintChallenge/constants";
import { fingerprintChallengeBase } from "./drizzleBase";

/** prompt (質問定義 JSONB) の保存上限バイト数 */
const MAX_PROMPT_BYTES = 16384;
/** answers (回答 JSONB) の保存上限バイト数。超過は 400 (回答は一次データのため黙って落とさない) */
const MAX_ANSWERS_BYTES = 65536;

const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

/** pending かつ期限超過の行を "expired" として導出する (DB には書かない) */
export function resolveEffectiveStatus(challenge: {
  status: FingerprintChallenge["status"];
  expiresAt: Date;
}): EffectiveChallengeStatus {
  if (challenge.status === "pending" && challenge.expiresAt.getTime() < Date.now()) {
    return "expired";
  }
  return challenge.status;
}

const toUserFacing = (challenge: FingerprintChallenge): FingerprintChallengeForUser => ({
  id: challenge.id,
  status: resolveEffectiveStatus(challenge),
  prompt: challenge.prompt,
  expiresAt: challenge.expiresAt,
  submittedAt: challenge.submittedAt,
  createdAt: challenge.createdAt,
});

export type IssueChallengeResult = {
  challenge: FingerprintChallenge;
  /**
   * 回答 URL 用の生トークン。この返却が唯一の取得機会 (DB には SHA-256 のみ保存)。
   * downstream のフォームページ URL に埋めてユーザーへ案内する (README のレシピ参照)。
   */
  token: string;
};

/**
 * チャレンジを発行する。呼び出し側 (admin ルート) で対象ユーザーの存在確認と
 * FINGERPRINT_CONFIG.challenge.enabled のゲートを済ませていること。
 */
export async function issueChallenge(
  input: IssueChallengeInput & { issuedBy: string | null },
): Promise<IssueChallengeResult> {
  if (input.prompt !== undefined && JSON.stringify(input.prompt).length > MAX_PROMPT_BYTES) {
    throw new DomainError("質問定義 (prompt) が大きすぎます", { status: 400 });
  }

  const token = randomBytes(32).toString("base64url");
  const expiresInDays =
    input.expiresInDays ?? FINGERPRINT_CONFIG.challenge.defaultExpiresInDays;
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  const challenge = await db.transaction(async (tx) => {
    const created = (await fingerprintChallengeBase.create(
      {
        userId: input.userId,
        tokenHash: hashToken(token),
        prompt: input.prompt,
        issuedBy: input.issuedBy,
        expiresAt,
      },
      tx,
    )) as unknown as FingerprintChallenge;

    await auditLogger.record({
      targetType: "fingerprintChallenge",
      targetId: created.id,
      subjectUserId: input.userId,
      action: "fingerprint.challenge.issued",
      after: { userId: input.userId, expiresAt: expiresAt.toISOString() },
      tx,
    });

    return created;
  });

  return { challenge, token };
}

/** 生トークンから行を引く内部専用ヘルパー (token_hash は外に出さない) */
async function findByToken(token: string) {
  const rows = await db
    .select()
    .from(FingerprintChallengeTable)
    .where(eq(FingerprintChallengeTable.tokenHash, hashToken(token)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * 回答者本人向けのチャレンジ取得。
 * トークン一致 + セッションユーザー一致の二重検証。他人のトークンや存在しない
 * トークンは区別せず 404 (トークンの存在を漏らさない)。
 */
export async function getChallengeForUser(
  token: string,
  userId: string,
): Promise<FingerprintChallengeForUser> {
  const row = await findByToken(token);
  if (!row || row.userId !== userId) {
    throw new DomainError("チャレンジが見つかりません", { status: 404 });
  }
  return toUserFacing(row as unknown as FingerprintChallenge);
}

export type SubmitChallengeParams = {
  token: string;
  userId: string;
  /** リクエストボディ (Zod 検証はこの関数内で行う) */
  body: unknown;
};

/**
 * 回答を提出する。デバイスフィンガープリント (必須) と行動計測 payload を
 * 同一トランザクションで記録・添付し、状態を submitted に遷移する。
 */
export async function submitChallenge(
  params: SubmitChallengeParams,
): Promise<FingerprintChallengeForUser> {
  const parsed = SubmitChallengeSchema.safeParse(params.body);
  if (!parsed.success) {
    throw new DomainError("回答の形式が不正です", { status: 400 });
  }
  const input = parsed.data;

  if (JSON.stringify(input.answers ?? null).length > MAX_ANSWERS_BYTES) {
    throw new DomainError("回答が大きすぎます", { status: 400 });
  }

  const behavior =
    input.behavior !== undefined &&
    JSON.stringify(input.behavior).length <= FINGERPRINT_CONFIG.challenge.maxBehaviorBytes
      ? input.behavior
      : null;

  const updated = await db.transaction(async (tx) => {
    // 二重提出の競合を防ぐため行ロックを取ってから状態を検証する
    const rows = await tx
      .select()
      .from(FingerprintChallengeTable)
      .where(eq(FingerprintChallengeTable.tokenHash, hashToken(params.token)))
      .for("update")
      .limit(1);
    const row = rows[0] ?? null;

    if (!row || row.userId !== params.userId) {
      throw new DomainError("チャレンジが見つかりません", { status: 404 });
    }
    const effective = resolveEffectiveStatus(row);
    if (effective === "expired") {
      throw new DomainError("このチャレンジは期限切れです", { status: 410 });
    }
    if (effective !== "pending") {
      throw new DomainError("このチャレンジは回答済みです", { status: 409 });
    }

    const fingerprint = await recordDeviceFingerprint({
      userId: params.userId,
      source: "challenge",
      payload: input.fingerprint,
      tx,
    });

    const result = (await fingerprintChallengeBase.update(
      row.id,
      {
        status: "submitted",
        answers: input.answers,
        behavior,
        fingerprintId: fingerprint.id,
        submittedAt: new Date(),
        updatedAt: new Date(),
      },
      tx,
    )) as unknown as FingerprintChallenge;

    await auditLogger.record({
      targetType: "fingerprintChallenge",
      targetId: row.id,
      subjectUserId: params.userId,
      action: "fingerprint.challenge.submitted",
      after: { fingerprintId: fingerprint.id },
      tx,
    });

    return result;
  });

  return toUserFacing(updated);
}

export type ReviewChallengeParams = {
  challengeId: string;
  reviewedBy: string;
  note?: string | null;
};

/** 提出済みチャレンジをレビュー済みにする (admin 専用ルートから呼ばれる) */
export async function reviewChallenge(
  params: ReviewChallengeParams,
): Promise<FingerprintChallenge> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(FingerprintChallengeTable)
      .where(eq(FingerprintChallengeTable.id, params.challengeId))
      .for("update")
      .limit(1);
    const row = rows[0] ?? null;
    if (!row) throw new DomainError("チャレンジが見つかりません", { status: 404 });
    if (row.status !== "submitted") {
      throw new DomainError("提出済みのチャレンジのみレビューできます", { status: 409 });
    }

    const updated = (await fingerprintChallengeBase.update(
      row.id,
      {
        status: "reviewed",
        reviewedAt: new Date(),
        reviewedBy: params.reviewedBy,
        reviewNote: params.note ?? null,
        updatedAt: new Date(),
      },
      tx,
    )) as unknown as FingerprintChallenge;

    await auditLogger.record({
      targetType: "fingerprintChallenge",
      targetId: row.id,
      subjectUserId: row.userId,
      action: "fingerprint.challenge.reviewed",
      before: { status: row.status },
      after: { status: "reviewed" },
      reason: params.note ?? null,
      tx,
    });

    return updated;
  });
}

export type CancelChallengeParams = {
  challengeId: string;
  canceledBy: string;
  note?: string | null;
};

/** 未回答のチャレンジを取り下げる (admin 専用ルートから呼ばれる) */
export async function cancelChallenge(
  params: CancelChallengeParams,
): Promise<FingerprintChallenge> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(FingerprintChallengeTable)
      .where(eq(FingerprintChallengeTable.id, params.challengeId))
      .for("update")
      .limit(1);
    const row = rows[0] ?? null;
    if (!row) throw new DomainError("チャレンジが見つかりません", { status: 404 });
    if (row.status !== "pending") {
      throw new DomainError("未回答のチャレンジのみ取り下げできます", { status: 409 });
    }

    const updated = (await fingerprintChallengeBase.update(
      row.id,
      { status: "canceled", updatedAt: new Date() },
      tx,
    )) as unknown as FingerprintChallenge;

    await auditLogger.record({
      targetType: "fingerprintChallenge",
      targetId: row.id,
      subjectUserId: row.userId,
      action: "fingerprint.challenge.canceled",
      before: { status: row.status },
      after: { status: "canceled" },
      reason: params.note ?? null,
      tx,
    });

    return updated;
  });
}
