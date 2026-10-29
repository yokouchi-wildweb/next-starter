// src/features/core/userProfile/services/server/operations/upsertProfile.ts

import { hasRoleProfile, type UserRoleType } from "@/features/core/user/constants";
import { DomainError } from "@/lib/errors";
import { isSafeHttpUrl } from "@/utils/url";
import { getProfileBase } from "../../../utils/profileBaseHelpers";

/**
 * プロフィール作成/更新用データ型
 */
export type ProfileUpsertData = Record<string, unknown>;

/**
 * プロフィールを作成または更新（upsert）
 * userId の unique 制約で衝突した場合は更新
 */
export async function upsertProfile(
  userId: string,
  role: UserRoleType,
  data: ProfileUpsertData,
): Promise<Record<string, unknown>> {
  if (!hasRoleProfile(role)) {
    throw new Error(`Role "${role}" does not have a profile`);
  }

  const base = getProfileBase(role);
  if (!base) {
    throw new Error(`Profile base for role "${role}" is not registered`);
  }

  // SSR→クライアント経由で文字列化された管理フィールドを除去
  const { id: _id, userId: _userId, createdAt: _createdAt, updatedAt: _updatedAt, ...profileFields } = data;

  // URL の項目(キー名が Url で終わる)は http(s) だけを通す。画面で href に渡るため、
  // javascript: 等のスキームによる stored XSS をサーバーで弾く(クライアントの検証は迂回できる)
  for (const [key, value] of Object.entries(profileFields)) {
    if (key.endsWith("Url") && typeof value === "string" && value !== "" && !isSafeHttpUrl(value)) {
      throw new DomainError("URL は http:// または https:// で始まる形で入力してください", { status: 400 });
    }
  }

  // upsert は userId での衝突検知（defaultUpsertConflictFields: ["userId"]）
  return base.upsert({ userId, ...profileFields });
}
