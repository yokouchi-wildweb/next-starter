// src/lib/recaptcha/server/verifyRecaptchaV2.ts

import { RECAPTCHA_V2_INTERNALS } from "@/lib/recaptcha/constants";

/**
 * reCAPTCHA v2 検証レスポンス
 */
type RecaptchaV2VerifyResponse = {
  success: boolean;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
};

/**
 * reCAPTCHA v2 検証結果
 */
export type RecaptchaV2VerifyResult = {
  /** 検証成功か */
  valid: boolean;
  /** エラーメッセージ（検証失敗時） */
  error?: string;
};

/**
 * reCAPTCHA v2 トークンを検証する
 *
 * v2はスコアベースではなく、チャレンジ（チェックボックス/パズル）を
 * クリアしたかどうかのみを判定する。
 *
 * @param token - クライアントから送信されたv2トークン
 * @returns 検証結果
 */
export async function verifyRecaptchaV2(
  token: string,
): Promise<RecaptchaV2VerifyResult> {
  // reCAPTCHA v2が無効な場合は常に成功
  if (!RECAPTCHA_V2_INTERNALS.enabled) {
    return { valid: true };
  }

  if (!token) {
    return { valid: false, error: "reCAPTCHA v2トークンが提供されていません" };
  }

  try {
    const response = await fetch(RECAPTCHA_V2_INTERNALS.verifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        secret: RECAPTCHA_V2_INTERNALS.secretKey,
        response: token,
      }),
    });

    if (!response.ok) {
      return { valid: false, error: "reCAPTCHA v2検証APIへの接続に失敗しました" };
    }

    const data: RecaptchaV2VerifyResponse = await response.json();

    if (!data.success) {
      const errorCodes = data["error-codes"]?.join(", ") ?? "unknown";
      return { valid: false, error: `reCAPTCHA v2検証エラー: ${errorCodes}` };
    }

    return { valid: true };
  } catch (error) {
    console.error("reCAPTCHA v2 verification failed:", error);
    return { valid: false, error: "reCAPTCHA v2検証中にエラーが発生しました" };
  }
}
