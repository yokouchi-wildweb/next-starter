// src/lib/firebase/client/checkActionCodeValidity.ts

"use client";

import { checkActionCode } from "firebase/auth";

import { auth } from "@/lib/firebase/client/app";

/**
 * Firebase Auth のアクションコードが有効かどうかを判定します。
 *
 * 認証リンクに付与された `oobCode` を検証し、期限切れや無効なコードであれば `false` を返却します。
 */
export async function checkActionCodeValidity(oobCode: string): Promise<boolean> {
  try {
    await checkActionCode(auth, oobCode);
    return true;
  } catch (error) {
    console.warn("checkActionCode() に失敗しました", error);

    return false;
  }
}
