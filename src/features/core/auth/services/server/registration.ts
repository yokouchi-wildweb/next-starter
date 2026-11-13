// src/features/core/auth/services/server/registration.ts

import type { z } from "zod";

import { REGISTRATION_DEFAULT_ROLE } from "@/features/core/auth/constants/registration";
import {
  USER_REGISTERED_STATUSES,
  hasRoleProfile,
  type UserRoleType,
} from "@/features/core/user/constants";
import { RegistrationSchema } from "@/features/core/auth/entities";
import type { SessionUser } from "@/features/core/auth/entities/session";
import type { User } from "@/features/core/user/entities";
import { userService } from "@/features/core/user/services/server/userService";
import { registerFromAuth } from "@/features/core/user/services/server/registration";
import { userProfileService } from "@/features/core/userProfile/services/server/userProfileService";
import { assertRoleEnabled } from "@/features/core/user/utils/roleHelpers";
import { DomainError } from "@/lib/errors";
import { getServerAuth } from "@/lib/firebase/server/app";
import { SESSION_DEFAULT_MAX_AGE_SECONDS } from "@/lib/jwt";
import { gate } from "@/featureGate";
import { couponService } from "@/features/core/coupon/services/server/couponService";
import type { RegistrationInviteCodeResult } from "@/features/core/auth/entities/registration";
import { INVITE_CODE_REDEEM_SCOPE } from "@/features/core/referral/constants/inviteCodeScope";
import { recordSignupAcquisition } from "@/features/core/userAcquisition/services/server";
import { messagingService } from "@/features/core/messaging/services/server";
import { recordSignupMarketingConsent } from "./marketingConsent";
import { runPostRegistrationMilestones } from "./postRegistrationMilestones";
import type {
  AcquisitionExtras,
  AcquisitionTouch,
} from "@/features/core/userAcquisition/entities/model";
import { assertAuthenticatedAfterInvalidation } from "./session/invalidationBoundary";
import { issueSessionToken } from "./session/sessionToken";

export type RegistrationInput = z.infer<typeof RegistrationSchema>;

/**
 * 流入経路（アトリビューション）情報。
 * クライアント入力ではなく、API ルートがサーバーサイドで cookie から復元して渡す。
 */
export type RegistrationAcquisitionInput = {
  touches: AcquisitionTouch[];
  extras?: AcquisitionExtras | null;
};

export type { RegistrationInviteCodeResult };

export type RegistrationResult = {
  user: User;
  sessionUser: SessionUser;
  session: {
    token: string;
    expiresAt: Date;
    maxAge: number;
  };
  inviteCode: RegistrationInviteCodeResult | null;
};

export async function register(
  input: unknown,
  ip?: string,
  acquisition?: RegistrationAcquisitionInput,
  /** 招待リンク由来の保留コード（referral 専用 cookie から API ルートが復元して渡す） */
  pendingInviteCode?: string | null,
): Promise<RegistrationResult> {
  const parsedResult = RegistrationSchema.safeParse(input);

  if (!parsedResult.success) {
    throw new DomainError("本登録の入力内容が不正です。", { status: 400 });
  }

  const {
    providerType,
    providerUid,
    idToken,
    email,
    name,
    password,
    role: requestedRole,
    profileData,
    inviteCode,
    marketingConsent,
  } = parsedResult.data;

  // ロールの決定（指定がない場合はデフォルトを使用）
  const role = requestedRole ?? REGISTRATION_DEFAULT_ROLE;

  // ロールの有効性チェック
  assertRoleEnabled(role);

  const auth = getServerAuth();

  let decodedToken;
  try {
    // checkRevoked=true: 失効済み（revokeRefreshTokens 後）・無効化されたユーザーのトークンも拒否する。
    decodedToken = await auth.verifyIdToken(idToken, true);
  } catch (error) {
    console.error("Failed to verify ID token in register", error);
    throw new DomainError("認証情報の検証に失敗しました", { status: 401 });
  }

  if (!decodedToken?.uid) {
    throw new DomainError("プロバイダー UID を特定できませんでした", { status: 400 });
  }

  if (decodedToken.uid !== providerUid) {
    throw new DomainError("認証情報が一致しません", { status: 400 });
  }

  // email プロバイダーはトークンの email とフォームの email が一致しなければならない。
  // preRegistration と対称の検証。フォームの email が localStorage 由来で、資格情報が
  // 別アカウント（例: 退会済み旧アカウントへのログイン残留セッション）になっている場合に、
  // 旧アカウントを rejoin して email を上書きしてしまう事故を防ぐ。
  // updateUser(password) より前に置くことで旧アカウントのパスワード上書きも防ぐ。
  if (providerType === "email") {
    const emailFromToken =
      typeof decodedToken.email === "string" ? decodedToken.email.trim().toLowerCase() : null;
    const emailFromRequest = email.trim().toLowerCase();

    if (!emailFromToken || emailFromToken !== emailFromRequest) {
      throw new DomainError("メールアドレスが一致しません", { status: 400 });
    }
  }

  const existingUser = await userService.findByProvider(providerType, providerUid);

  if (!existingUser) {
    throw new DomainError("仮登録が完了していません。先に仮登録を行ってください", { status: 400 });
  }

  // 全セッション失効の境目より前に認証した Firebase のセッションからは登録もセッションも進めない
  // (パスワードの書き換えより前。Firebase の取り消しが失敗していても止める。./session/invalidationBoundary.ts)
  assertAuthenticatedAfterInvalidation(decodedToken, existingUser);

  if (USER_REGISTERED_STATUSES.includes(existingUser.status)) {
    throw new DomainError("このアカウントはすでに本登録が完了しています", { status: 409 });
  }

  if (providerType === "email") {
    if (!password) {
      throw new DomainError("パスワード情報が不足しています", { status: 400 });
    }

    try {
      await auth.updateUser(providerUid, { password });
    } catch (error) {
      console.error("Failed to update Firebase password in register", error);
      throw new DomainError("パスワードの設定に失敗しました", { status: 500 });
    }
  }

  // 宣伝の同意（./marketingConsent.ts）: 有効化の前に仮登録の id で書く（activate は id を変えない）。
  // 書けなければ投げる = 有効化していないので登録はやり直せる（同意しない人が宣伝を受け取る形を残さない）
  await recordSignupMarketingConsent(existingUser.id, marketingConsent, {
    setPreference: messagingService.setMessagePreference,
  });

  // ユーザー登録処理を user ドメインに委譲
  const { user } = await registerFromAuth({
    email,
    name,
    existingUser,
    role,
    ip,
  });

  // プロフィールを持つロールの場合、プロフィールデータを保存
  if (hasRoleProfile(role as UserRoleType) && profileData) {
    await userProfileService.upsertProfile(user.id, role as UserRoleType, profileData);
  }

  // 流入経路の確定保存（recordSignupAcquisition は bestEffort 仕様のため登録をブロックしない）。
  // 流入経路の機能が閉じているときは保存しない（閉じる値。記録の opt-in とは別、L1.8）
  if (acquisition && acquisition.touches.length > 0 && gate.enabled("userAcquisition")) {
    await recordSignupAcquisition({
      userId: user.id,
      touches: acquisition.touches,
      extras: acquisition.extras,
    });
  }

  // 招待コード処理（失敗しても登録はブロックしない）
  // inviteCode の意味論:
  // - 非空: フォームの値を使用（手入力 / プリフィル値）
  // - "": プリフィルをユーザーが明示的に消した = 拒否（cookie フォールバックもしない）
  // - undefined: 未指定 → 招待リンク由来（referral 専用 cookie、last-touch 優先）へフォールバック
  const effectiveInviteCode =
    inviteCode !== undefined
      ? inviteCode || undefined
      : pendingInviteCode ?? undefined;
  // 受理するのは招待コード（type=invite）のみ。他種別（official / affiliate）は type_mismatch で不成立にする。
  // スコープ無しで消し込むと、使用回数だけ消費されて referral ハンドラーが走らず、
  // 招待報酬が両者とも恒久的に失われる（下流で実際に発生した事故）。
  let inviteCodeResult: RegistrationInviteCodeResult | null = null;
  // 招待コードの実体はクーポン。クーポン無効時はテーブルが無い場合があるため触らない
  if (
    gate.enabled("referral") &&
    gate.enabled("coupon") &&
    effectiveInviteCode
  ) {
    try {
      const redeemResult = await couponService.redeemWithEffect(
        effectiveInviteCode,
        user.id,
        { entryPoint: "registration" },
        undefined,
        { scope: INVITE_CODE_REDEEM_SCOPE },
      );
      inviteCodeResult = redeemResult.success
        ? { applied: true }
        : { applied: false, reason: redeemResult.reason };
      if (!redeemResult.success) {
        console.warn(
          `[registration] 招待コードを適用できませんでした（登録は続行）: reason=${redeemResult.reason}`,
        );
      }
    } catch (error) {
      inviteCodeResult = { applied: false, reason: "error" };
      console.warn("[registration] 招待コード処理に失敗しましたが登録は続行します:", error);
    }
  }

  // 登録後の処理（登録ボーナスなど）: milestone のトリガー user_registered を 1 回発火する。
  // 登録の守りをすべて通った後だけ。失敗しても登録はブロックしない（throw しない）
  await runPostRegistrationMilestones({
    user,
    role,
    providerType,
    inviteCode: inviteCodeResult,
  });

  // セッションに格納する情報を組み立ててトークンを署名する(通常の maxAge)。establishSession と同じ部品
  const { sessionUser, token, expiresAt, maxAge } = await issueSessionToken(user, {
    maxAge: SESSION_DEFAULT_MAX_AGE_SECONDS,
  });

  return {
    user,
    sessionUser,
    session: {
      token,
      expiresAt,
      maxAge,
    },
    inviteCode: inviteCodeResult,
  };
}

