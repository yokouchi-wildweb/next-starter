// src/features/user/services/server/wrappers/update.ts

import type { User } from "@/features/core/user/entities";
import { UserUpdateByAdminSchema } from "@/features/core/user/entities";
import type { UpdateUserInput } from "@/features/core/user/services/types";
import { base, baseOptions } from "../drizzleBase";
import { DomainError } from "@/lib/errors";
import { omitUndefined } from "@/utils/object";
import { getServerAuth } from "@/lib/firebase/server/app";
import { hasFirebaseErrorCode } from "@/lib/firebase/errors";
import { hasRoleProfile, type UserRoleType } from "@/features/core/user/constants";
import { userProfileService } from "@/features/core/userProfile/services/server/userProfileService";
import { syncBelongsToManyRelations } from "@/lib/crud/drizzle/belongsToMany";
import { db } from "@/lib/drizzle";
import { invalidateSessionsForUser } from "@/features/core/auth/services/server/sessionInvalidation";
import { resolveUserNameForGuard, withUserNameGuard } from "../helpers/nameAvailability";
import { planPasswordChange } from "../helpers/passwordChange";
import { assertSelfUpdateAllowed, selfUpdateSchema } from "../helpers/selfUpdate";
import { userFacingValidationMessage } from "../helpers/validationMessage";
import { USER_UPDATE_VALIDATION } from "@/config/app/user-update.config";

async function updateFirebaseEmail(uid: string, email: string): Promise<void> {
  const auth = getServerAuth();
  try {
    await auth.updateUser(uid, { email });
  } catch (error) {
    if (hasFirebaseErrorCode(error, "auth/email-already-exists")) {
      throw new DomainError("同じメールアドレスのユーザーが既に存在します", { status: 409 });
    }
    throw new DomainError("メールアドレスの更新に失敗しました", { status: 500 });
  }
}

async function updateFirebasePassword(uid: string, password: string): Promise<void> {
  const auth = getServerAuth();
  try {
    await auth.updateUser(uid, { password });
  } catch {
    throw new DomainError("パスワードの更新に失敗しました", { status: 500 });
  }
}

async function updateFirebasePhoneNumber(uid: string, phoneNumber: string | null): Promise<void> {
  const auth = getServerAuth();
  try {
    await auth.updateUser(uid, { phoneNumber });
  } catch (error) {
    if (hasFirebaseErrorCode(error, "auth/phone-number-already-exists")) {
      throw new DomainError("同じ電話番号のユーザーが既に存在します", { status: 409 });
    }
    throw new DomainError("電話番号の更新に失敗しました", { status: 500 });
  }

  // 電話番号クリア時は phone プロバイダーも解除する
  // （プロバイダーが残ると再登録時に auth/provider-already-linked エラーになる）
  // updateUser の phoneNumber:null と providersToUnlink は同時指定できないため分離
  if (phoneNumber === null) {
    try {
      const user = await auth.getUser(uid);
      const hasPhoneProvider = user.providerData.some(
        (p) => p.providerId === "phone",
      );
      if (hasPhoneProvider) {
        await auth.updateUser(uid, { providersToUnlink: ["phone"] });
      }
    } catch {
      // プロバイダー解除失敗は電話番号クリア自体には影響しないため無視
    }
  }
}

type UpdateSchema = typeof UserUpdateByAdminSchema | ReturnType<typeof selfUpdateSchema>;

/**
 * 認可済みの呼び手用の更新(汎用 API は管理者限定、サーバー内の処理)。セッションは読まない。
 * 利用者の入力をそのまま渡す route は updateSelf を使う(ここは管理者のスキーマで検証する)。
 */
export async function update(id: string, rawData?: UpdateUserInput): Promise<User> {
  return applyUpdate(id, rawData, UserUpdateByAdminSchema);
}

/** 本人の更新。actor は route の ctx.user */
export async function updateSelf(actor: { userId: string; role: string }, rawData?: UpdateUserInput): Promise<User> {
  return applyUpdate(actor.userId, rawData, selfUpdateSchema(actor), (current) =>
    assertSelfUpdateAllowed(actor, current.providerType),
  );
}

async function applyUpdate(
  id: string,
  rawData: UpdateUserInput | undefined,
  schema: UpdateSchema,
  guard?: (current: User) => void,
): Promise<User> {
  if (!rawData || typeof rawData !== "object") {
    throw new DomainError("更新データが不正です", { status: 400 });
  }

  const { newPassword, profileData, user_tag_ids, ...restRawData } = rawData;

  const current = await base.get(id);
  if (!current) {
    throw new DomainError("ユーザーが見つかりません", { status: 404 });
  }

  guard?.(current);

  // newPassword (プロバイダー非依存の「パスワード設定」契約) を保存先へ振り分ける。
  // local → localPassword としてスキーマ入力にマージ (hash 変換はスキーマが担当)
  // email → Firebase Auth へ同期
  // パスワード経路の無いプロバイダーに newPassword が来た場合はここで 400 (無言成功禁止)
  const passwordPlan = planPasswordChange({
    providerType: current.providerType,
    newPassword,
  });
  const schemaInput =
    passwordPlan.localPassword !== undefined
      ? { ...restRawData, localPassword: passwordPlan.localPassword }
      : restRawData;

  const result = await schema.safeParseAsync(schemaInput);

  if (!result.success) {
    // 値は出さない(パスワードなどが入り得る)
    console.warn(
      "[userService.update] 検証エラー:",
      result.error.errors.map((issue) => ({ path: issue.path.join("."), code: issue.code })),
    );
    throw new DomainError(
      userFacingValidationMessage(result.error.errors[0], USER_UPDATE_VALIDATION.fallbackMessage),
      { status: 400 },
    );
  }

  // phoneNumber は管理者更新時のみスキーマに含まれる
  const parsedData = result.data as Record<string, unknown>;
  const { localPassword, ...rest } = result.data;
  const phoneNumber = parsedData.phoneNumber as string | null | undefined;

  const shouldSyncFirebaseEmail =
    current.providerType === "email" &&
    typeof rest.email === "string" &&
    rest.email.length > 0 &&
    rest.email !== current.email;

  if (shouldSyncFirebaseEmail) {
    await updateFirebaseEmail(current.providerUid, rest.email as string);
  }

  const shouldSyncFirebasePassword = passwordPlan.firebasePassword !== undefined;

  if (passwordPlan.firebasePassword !== undefined) {
    await updateFirebasePassword(current.providerUid, passwordPlan.firebasePassword);
  }

  // 電話番号の Firebase 同期（local はFirebase Auth不使用のためDB更新のみ）
  const shouldSyncFirebasePhone =
    current.providerType !== "local" &&
    phoneNumber !== undefined &&
    phoneNumber !== current.phoneNumber;

  if (shouldSyncFirebasePhone) {
    await updateFirebasePhoneNumber(
      current.providerUid,
      phoneNumber ?? null,
    );
  }

  const updatePayload = omitUndefined(rest) as Partial<User>;

  if (current.providerType === "local" && localPassword !== undefined) {
    updatePayload.localPassword = localPassword;
    // ローカル認証ユーザーのパスワード変更時はロックアウト関連カウンタを同時リセット。
    // (管理者によるパスワード再発行で即時再ログイン可能にするため)
    updatePayload.failedLoginCount = 0;
    updatePayload.lockedUntil = null;
    updatePayload.lastFailedLoginAt = null;
  }

  // 電話番号変更時に phoneVerifiedAt も更新
  if (phoneNumber !== undefined && phoneNumber !== current.phoneNumber) {
    updatePayload.phoneNumber = phoneNumber;
    updatePayload.phoneVerifiedAt = phoneNumber ? new Date() : null;
  }

  // ユーザー情報の更新 (表示名が変わる場合・デモから通常に戻す場合は一意性ガードを通す)
  const nameForGuard = resolveUserNameForGuard(current, updatePayload);
  const updatedUser =
    Object.keys(updatePayload).length === 0
      ? current
      : await withUserNameGuard({ name: nameForGuard, excludeUserId: id }, (tx) =>
          base.update(id, updatePayload, tx),
        );

  // パスワード変更が発生した場合は全セッションを失効させる (既存 JWT 無効化 + Firebase revoke)。
  // local: localPassword (DB側) が更新された場合。
  // Firebase 系: shouldSyncFirebasePassword が true で Firebase 側パスワードが更新された場合。
  const passwordChanged =
    (current.providerType === "local" && localPassword !== undefined) ||
    shouldSyncFirebasePassword;

  if (passwordChanged) {
    await invalidateSessionsForUser({
      userId: id,
      providerUid: current.providerUid,
      reason: "password_change",
    });
  }

  // プロフィールデータの更新
  const effectiveRole = (updatePayload.role ?? current.role) as UserRoleType;
  if (profileData && hasRoleProfile(effectiveRole)) {
    await userProfileService.upsertProfile(id, effectiveRole, profileData);
  }

  // ユーザータグの同期
  if (user_tag_ids !== undefined) {
    const relationValues = new Map<string, unknown[]>();
    relationValues.set("user_tag_ids", user_tag_ids);
    await syncBelongsToManyRelations(
      db,
      baseOptions.belongsToManyRelations,
      id,
      relationValues,
    );
    (updatedUser as User).user_tag_ids = user_tag_ids;
  }

  return updatedUser;
}
