// src/features/core/user/services/server/wrappers/lockoutPolicy.ts

import { eq } from "drizzle-orm";

import { AUTH_LOCKOUT_CONFIG } from "@/config/app/auth-lockout.config";
import { UserTable } from "@/features/core/user/entities/drizzle";
import { auditLogger } from "@/features/core/auditLog/services/server";
import { db } from "@/lib/drizzle";
import type { User } from "@/features/core/user/entities";

/**
 * アカウントロックアウトの方針実装。
 *
 * 2 段階防御:
 * - 短期: locked_until フィールドに期限をセット (時間経過で自動解除)
 * - 永続: status を security_locked に遷移 (管理者解除のみ)
 *
 * 詳細仕様: src/config/app/auth-lockout.config.ts
 */

/** ロック状態の判定結果 */
export type LockState =
  | { kind: "unlocked" }
  | { kind: "short_locked"; lockedUntil: Date }
  | { kind: "permanent_locked" };

/**
 * ユーザーの現在のロック状態を判定する (純粋関数、DB 参照なし)。
 *
 * - status === "security_locked" → 永続ロック
 * - locked_until が未来 → 短期ロック中
 * - locked_until が過去 / null → 解除済み (時間経過で実質解除されている)
 */
export function checkLockState(
  user: Pick<User, "status" | "lockedUntil">,
): LockState {
  if (user.status === "security_locked") {
    return { kind: "permanent_locked" };
  }
  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    return { kind: "short_locked", lockedUntil: user.lockedUntil };
  }
  return { kind: "unlocked" };
}

/** ログイン失敗を記録した結果 */
export type FailedLoginOutcome =
  | { kind: "counted"; failedLoginCount: number }
  | { kind: "short_locked"; failedLoginCount: number; lockedUntil: Date }
  | { kind: "permanent_locked"; failedLoginCount: number };

/**
 * ログイン失敗を記録し、必要に応じてロックを発動する。
 *
 * - 直近失敗から countResetWindowSeconds 秒以上経過していれば、累積を 0 にしてから ++
 * - newCount >= permanentLockThreshold → status を security_locked に遷移
 * - newCount >= shortLockThreshold → locked_until を now + shortLockDurationSeconds 秒先にセット
 * - 上記いずれでもなければカウントのみ更新
 *
 * 短期ロック中の試行で本関数は呼ばれない想定 (呼び出し側で checkLockState で弾く)。
 * 監査ログ (locked_short / locked_permanent) は best-effort で記録する。
 */
export async function recordFailedLogin(
  user: Pick<User, "id" | "failedLoginCount" | "lastFailedLoginAt" | "status">,
): Promise<FailedLoginOutcome> {
  const now = new Date();
  const resetWindowMs = AUTH_LOCKOUT_CONFIG.countResetWindowSeconds * 1000;

  const baseCount =
    user.lastFailedLoginAt &&
    now.getTime() - user.lastFailedLoginAt.getTime() < resetWindowMs
      ? user.failedLoginCount
      : 0;
  const newCount = baseCount + 1;

  if (newCount >= AUTH_LOCKOUT_CONFIG.permanentLockThreshold) {
    await db
      .update(UserTable)
      .set({
        failedLoginCount: newCount,
        lastFailedLoginAt: now,
        lockedUntil: null,
        status: "security_locked",
        updatedAt: now,
      })
      .where(eq(UserTable.id, user.id));

    await auditLogger.record({
      targetType: "user",
      targetId: user.id,
      subjectUserId: user.id,
      action: "auth.account.locked_permanent",
      before: { status: user.status, failedLoginCount: baseCount },
      after: { status: "security_locked", failedLoginCount: newCount },
      bestEffort: true,
    });

    return { kind: "permanent_locked", failedLoginCount: newCount };
  }

  if (newCount >= AUTH_LOCKOUT_CONFIG.shortLockThreshold) {
    const lockedUntil = new Date(
      now.getTime() + AUTH_LOCKOUT_CONFIG.shortLockDurationSeconds * 1000,
    );
    await db
      .update(UserTable)
      .set({
        failedLoginCount: newCount,
        lastFailedLoginAt: now,
        lockedUntil,
        updatedAt: now,
      })
      .where(eq(UserTable.id, user.id));

    await auditLogger.record({
      targetType: "user",
      targetId: user.id,
      subjectUserId: user.id,
      action: "auth.account.locked_short",
      before: { failedLoginCount: baseCount },
      after: {
        failedLoginCount: newCount,
        lockedUntil: lockedUntil.toISOString(),
      },
      bestEffort: true,
    });

    return { kind: "short_locked", failedLoginCount: newCount, lockedUntil };
  }

  await db
    .update(UserTable)
    .set({
      failedLoginCount: newCount,
      lastFailedLoginAt: now,
      updatedAt: now,
    })
    .where(eq(UserTable.id, user.id));

  return { kind: "counted", failedLoginCount: newCount };
}

/**
 * ロック関連の状態を全クリアする。
 *
 * - failed_login_count = 0
 * - locked_until = null
 * - last_failed_login_at = null
 *
 * パスワードリセット完了や管理者による security_locked 解除など、
 * 単独でクリア処理だけを行いたい場面で使用する。
 * ログイン成功時は updateLastAuthenticated 内で同等のクリアが行われるため不要。
 *
 * status は本関数では変更しない (呼び出し側で扱う)。
 */
export async function clearLockState(userId: string): Promise<void> {
  await db
    .update(UserTable)
    .set({
      failedLoginCount: 0,
      lockedUntil: null,
      lastFailedLoginAt: null,
      updatedAt: new Date(),
    })
    .where(eq(UserTable.id, userId));
}

/** 短期ロック中の認証失敗で表示するエラーメッセージ */
export function formatShortLockMessage(lockedUntil: Date): string {
  const time = lockedUntil.toLocaleTimeString("ja-JP", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `アカウントが一時的にロックされています。${time} 以降に再試行してください。`;
}

/** 永続ロック中の認証失敗で表示するエラーメッセージ */
export const PERMANENT_LOCK_MESSAGE =
  "セキュリティ上の理由でアカウントがロックされています。サポートまでご連絡ください。";
