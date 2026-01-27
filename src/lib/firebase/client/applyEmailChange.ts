// src/lib/firebase/client/applyEmailChange.ts

"use client";

import { applyActionCode, checkActionCode } from "firebase/auth";

import { auth } from "@/lib/firebase/client/app";

export type EmailChangeInfo = {
  /** 変更前のメールアドレス */
  previousEmail: string | null;
  /** 変更後のメールアドレス */
  newEmail: string | null;
};

/**
 * メールアドレス変更のアクションコードを検証し、情報を取得します。
 */
export async function getEmailChangeInfo(oobCode: string): Promise<EmailChangeInfo | null> {
  try {
    const info = await checkActionCode(auth, oobCode);

    if (info.operation !== "VERIFY_AND_CHANGE_EMAIL") {
      console.warn("このアクションコードはメールアドレス変更用ではありません", info.operation);
      return null;
    }

    return {
      previousEmail: info.data.previousEmail ?? null,
      newEmail: info.data.email ?? null,
    };
  } catch (error) {
    console.warn("checkActionCode() に失敗しました", error);
    return null;
  }
}

/**
 * Firebase Auth のアクションコードを適用してメールアドレス変更を完了します。
 */
export async function applyEmailChange(oobCode: string): Promise<boolean> {
  try {
    await applyActionCode(auth, oobCode);
    return true;
  } catch (error) {
    console.error("applyActionCode() に失敗しました", error);
    return false;
  }
}
