// 招待コードのログイン前検証クライアントサービス

import axios from "axios";

import { normalizeHttpError } from "@/lib/errors";

export type ValidateInviteCodeResponse =
  | { valid: true }
  | { valid: false; message: string };

/**
 * 招待コードが有効かをログイン前に確認する。
 * サインアップフォームの招待コード欄のインライン検証に使う。
 * 理由コードは返らない（存在の列挙を防ぐため valid と文言のみ）。
 */
export async function validateInviteCode(code: string): Promise<ValidateInviteCodeResponse> {
  try {
    const { data } = await axios.post<ValidateInviteCodeResponse>(
      "/api/referral/validate-invite-code",
      { code },
    );
    return data;
  } catch (error) {
    throw normalizeHttpError(error, "招待コードの確認に失敗しました。");
  }
}
