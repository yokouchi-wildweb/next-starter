// src/features/auth/config/authSettings.ts

import type { ActionCodeSettings } from "firebase/auth";

import { normalizeHttpError } from "@/lib/errors";

type ActionCodeSettingsOptions = {
  origin?: string | null;
};

export const AUTH_CONTINUE_URL = "/signup/verify";
export const EMAIL_SIGNUP_STORAGE_KEY = "signup.email";
// OAuth 仮登録の情報を保持するためのローカルストレージキー
export const OAUTH_SIGNUP_STORAGE_KEY = "signup.oauth";

/**
 * Firebase Auth のメールリンクを送信する際に利用する ActionCodeSettings を解決します。
 *
 * - 引数の origin、もしくはクライアントのドメインに AUTH_CONTINUE_URL を付与した URL を利用
 */
export function getActionCodeSettings(
  options: ActionCodeSettingsOptions = {},
): ActionCodeSettings {
  try {
    const origin =
      options.origin ?? (typeof window !== "undefined" ? window.location.origin : undefined);
    const url = origin ? `${origin.replace(/\/$/, "")}${AUTH_CONTINUE_URL}` : undefined;

    if (!url) {
      throw new Error("メールリンク送信時の遷移先URLを取得できませんでした。");
    }

    return {
      url,
      handleCodeInApp: true,
    };
  } catch (error: unknown) {
    throw normalizeHttpError(error, "メール送信設定の解決に失敗しました");
  }
}
