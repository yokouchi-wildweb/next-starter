// src/features/core/user/services/server/resolvers/requireUserRecord.ts

import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";

import type { User } from "@/features/core/user/entities/model";

import { base } from "../drizzleBase";

// 同じリクエストで同じ利用者を引く loader が重なっても DB は 1 回(キーは userId のプリミティブ)
const getUserRecord = cache(async (userId: string): Promise<User | null> => (await base.get(userId)) ?? null);

/**
 * loader の主体(guard.ts の createLoader が渡す ctx.user)から本人のユーザーレコードを引く。
 * 主体が無い・レコードが無い(削除済み等)なら redirectTo へ。ページの loader が本人の列(email・電話番号等)を要るときに使う
 * (主体の解決と認可は createLoader が済ませている。ここはレコードの取得だけ)
 */
export async function requireUserRecord(principal: { userId: string } | null, redirectTo: string): Promise<User> {
  if (!principal) redirect(redirectTo);
  const user = await getUserRecord(principal.userId);
  if (!user) redirect(redirectTo);
  return user;
}
