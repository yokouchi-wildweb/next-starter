// src/features/core/user/services/server/helpers/selfUpdate.ts
// 本人の更新(updateSelf)の規則。主体は呼び手(route の ctx.user)が渡す。

import { UserSelfUpdateSchema, UserUpdateByAdminSchema } from "@/features/core/user/entities";
import { getRoleCategory } from "@/features/core/user/constants";
import { DomainError } from "@/lib/errors";

const LOCAL_SELF_UPDATE_MESSAGE =
  "現在、ローカル認証ユーザーでログイン中です。このユーザーにはプロフィール編集画面が提供されていません。";

type SelfUpdateActor = { userId: string; role: string };

/** 管理者が自分を編集するときは管理者のスキーマ、それ以外は本人のスキーマ */
export function selfUpdateSchema(actor: SelfUpdateActor) {
  return getRoleCategory(actor.role) === "admin" ? UserUpdateByAdminSchema : UserSelfUpdateSchema;
}

/** 非管理者のローカル認証ユーザーは自分を更新できない(管理者は可) */
export function assertSelfUpdateAllowed(actor: SelfUpdateActor, providerType: string): void {
  if (getRoleCategory(actor.role) !== "admin" && providerType === "local") {
    throw new DomainError(
      LOCAL_SELF_UPDATE_MESSAGE,
      { status: 400 },
    );
  }
}
