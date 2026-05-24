// src/features/auth/services/server/localLogin.ts

import { z } from "zod";

import { SessionUserSchema } from "@/features/core/auth/entities/session";
import type { SessionUser } from "@/features/core/auth/entities/session";
import { verifyPassword } from "@/features/core/auth/utils/password";
import { userService, formatShortLockMessage, PERMANENT_LOCK_MESSAGE } from "@/features/core/user/services/server/userService";
import { AccountLockedEmail } from "@/features/core/mail/templates/AccountLockedEmail";
import { auditLogger } from "@/features/core/auditLog/services/server";
import { recordLoginFailure } from "./loginAudit";
import { invalidateSessionsForUser } from "./sessionInvalidation";
import { DomainError } from "@/lib/errors";
import { getServerAuth } from "@/lib/firebase/server/app";
import { signUserToken, SESSION_DEFAULT_MAX_AGE_SECONDS } from "@/lib/jwt";
import type { User } from "@/features/core/user/entities";
import { getRoleCategory } from "@/features/core/user/constants";

export type LocalLoginInput = z.infer<typeof LocalLoginSchema> & {
  ip?: string;
};

// 入力値の形式を検証するためのスキーマ。未入力やフォーマット不正を網羅的に検知する。
const LocalLoginSchema = z.object({
  email: z
    .string({ required_error: "メールアドレスを入力してください" })
    .trim()
    .min(1, { message: "メールアドレスを入力してください" })
    .email({ message: "メールアドレスの形式が不正です" }),
  password: z
    .string({ required_error: "パスワードを入力してください" })
    .min(1, { message: "パスワードを入力してください" }),
});

export type LocalLoginResult = {
  user: SessionUser;
  session: {
    token: string;
    expiresAt: Date;
    maxAge: number;
  };
  requiresReactivation: boolean;
  firebaseCustomToken: string;
};

// 管理者カテゴリのアカウントであることを確認し、一般ユーザーのログインを遮断する。
// 違反時は recordLoginFailure で監査ログを残してから throw する。
async function assertAdminRole(user: User, email: string): Promise<void> {
  if (getRoleCategory(user.role) !== "admin") {
    await recordLoginFailure({ user, email, reason: "not_admin_role" });
    throw new DomainError("このアカウントではログインできません", { status: 403 });
  }
}

// 利用ステータスを検証し、ログイン可否を判定する。
// security_locked (永続ロック) と短期ロックは checkLockState / assertNotLocked で扱う。
async function assertLoginableStatus(user: User, email: string): Promise<void> {
  if (user.status === "pending") {
    await recordLoginFailure({ user, email, reason: "status_pending" });
    throw new DomainError("このアカウントは利用できません", { status: 403 });
  }
  if (user.status === "withdrawn") {
    await recordLoginFailure({ user, email, reason: "status_withdrawn" });
    throw new DomainError("このアカウントは利用できません", { status: 403 });
  }
  // active, inactive, suspended, banned はログイン許可
  // （inactive は復帰ページへ、suspended/banned は制限ページへ誘導）
}

// 現在のロック状態を検査し、ロック中ならその旨を throw する。
// 短期ロック中・永続ロック中とも、パスワード検証より前にブロックする (カウントは増分しない)。
async function assertNotLocked(user: User, email: string): Promise<void> {
  const state = userService.checkLockState(user);
  if (state.kind === "permanent_locked") {
    await recordLoginFailure({ user, email, reason: "permanent_locked" });
    throw new DomainError(PERMANENT_LOCK_MESSAGE, { status: 403 });
  }
  if (state.kind === "short_locked") {
    await recordLoginFailure({ user, email, reason: "short_locked" });
    throw new DomainError(formatShortLockMessage(state.lockedUntil), { status: 403 });
  }
}

/**
 * ローカル認証によるログイン処理。
 */
export async function localLogin(input: unknown): Promise<LocalLoginResult> {
  // 受け取った body を検証し、形式が崩れている場合は 400 を返す。
  const parsed = LocalLoginSchema.safeParse(input);

  if (!parsed.success) {
    throw new DomainError("ログイン情報が正しくありません", { status: 400 });
  }

  // 正常にパースしたメールアドレスとパスワードを取り出す。
  const { email, password } = parsed.data;
  // IPアドレスはスキーマ外で渡される
  const ip = (input as { ip?: string })?.ip;

  // ローカル認証ユーザーをメールアドレスで検索する。
  const user = await userService.findByLocalEmail(email);

  // 該当ユーザーが存在しなければ認証失敗とする。
  // 不明 email への試行パターン検知のため targetId=unknown:<hash> で監査ログ記録。
  if (!user) {
    await recordLoginFailure({ user: null, email, reason: "user_not_found" });
    throw new DomainError("メールアドレスまたはパスワードが正しくありません", { status: 401 });
  }

  // 権限・ロック状態・ステータスのチェックを先に行い、以降の処理を早期に中断する。
  // ロック検査はパスワード検証より先に置き、短期ロック中の試行を即ブロックする
  // (カウントを増分しないことで攻撃者が永続ロックへの到達を意図的に早められないようにする)。
  await assertAdminRole(user, email);
  await assertNotLocked(user, email);
  await assertLoginableStatus(user, email);

  // ハッシュ化されたパスワードと比較し、誤りがあれば同様に認証失敗。
  const passwordMatched = await verifyPassword(password, user.localPassword);

  if (!passwordMatched) {
    // 個別の失敗を監査ログに記録。続いて recordFailedLogin で
    // 累積カウント増分と (閾値到達なら) ロック発動を行う。
    // 両者は意味が異なるため両方記録する (個別失敗 vs ロック遷移)。
    await recordLoginFailure({ user, email, reason: "wrong_password" });
    const outcome = await userService.recordFailedLogin(user);
    if (outcome.kind === "permanent_locked") {
      // 永続ロック発動時は既存全セッションも即時失効させる。
      // (status=security_locked への遷移と同時に発火、A5 の責務)
      await invalidateSessionsForUser({
        userId: user.id,
        providerUid: user.providerUid,
        reason: "status_lock",
      });
      // 永続ロック通知メールを fire-and-forget で送信。
      // メール送信失敗で認証フローを止めない (失敗は warn ログのみ)。
      if (user.email) {
        AccountLockedEmail.send(user.email, {
          occurredAt: new Date().toLocaleString("ja-JP"),
          ip: ip ?? null,
        }).catch((err) => {
          console.warn("[lockout] failed to send account-locked notification", err);
        });
      }
      throw new DomainError(PERMANENT_LOCK_MESSAGE, { status: 403 });
    }
    if (outcome.kind === "short_locked") {
      throw new DomainError(formatShortLockMessage(outcome.lockedUntil), { status: 403 });
    }
    throw new DomainError("メールアドレスまたはパスワードが正しくありません", { status: 401 });
  }

  // assertNotLocked を通過した時点で lockedUntil は null または過去日時。
  // 直前まで短期ロック中だった (= lockedUntil が過去にセットされていた) 場合、
  // 時間経過で実質解除されている。「unlocked_auto」として監査ログを残す。
  if (user.lockedUntil) {
    await auditLogger.record({
      targetType: "user",
      targetId: user.id,
      action: "auth.account.unlocked_auto",
      before: {
        lockedUntil: user.lockedUntil.toISOString(),
        failedLoginCount: user.failedLoginCount,
      },
      after: { lockedUntil: null, failedLoginCount: 0 },
      bestEffort: true,
    });
  }

  // 最終認証日時を更新する (ロックアウト関連カウンタも併せてクリアされる)。
  await userService.updateLastAuthenticated(user.id, { ip });

  // セッションに格納する情報をスキーマで整形し、不正値混入を防ぐ。
  const sessionUser = SessionUserSchema.parse({
    userId: user.id,
    role: user.role,
    status: user.status,
    isDemo: user.isDemo,
    providerType: user.providerType,
    providerUid: user.providerUid,
    name: user.name,
  });

  // inactive の場合は復帰フラグを立てる
  const requiresReactivation = user.status === "inactive";

  // JWT の存続期間を定義し、トークンを署名する。
  const maxAge = SESSION_DEFAULT_MAX_AGE_SECONDS;
  const { token, expiresAt } = await signUserToken({
    subject: sessionUser.userId,
    claims: {
      role: sessionUser.role,
      status: sessionUser.status,
      isDemo: sessionUser.isDemo,
      providerType: sessionUser.providerType,
      providerUid: sessionUser.providerUid,
      name: sessionUser.name,
    },
    options: { maxAge },
  });

  // Firebase Storage のセキュリティルールで認証を通すためのカスタムトークンを生成する。
  const firebaseCustomToken = await getServerAuth().createCustomToken(
    sessionUser.userId,
    { admin: true },
  );

  // 呼び出し元へセッション情報とユーザー情報をまとめて返す。
  return {
    user: sessionUser,
    session: {
      token,
      expiresAt,
      maxAge,
    },
    requiresReactivation,
    firebaseCustomToken,
  };
}
