// src/lib/recaptcha/server/verifyRecaptcha.ts

import { RECAPTCHA_INTERNALS } from "@/lib/recaptcha/constants";

/**
 * reCAPTCHA検証レスポンス
 */
type RecaptchaVerifyResponse = {
  success: boolean;
  score?: number;
  action?: string;
  challenge_ts?: string;
  hostname?: string;
  "error-codes"?: string[];
};

/**
 * reCAPTCHA検証結果
 */
export type RecaptchaVerifyResult = {
  /** 検証成功かつスコアが閾値以上か */
  valid: boolean;
  /** スコア（0.0〜1.0） */
  score: number;
  /** エラーメッセージ（検証失敗時） */
  error?: string;
};

/**
 * reCAPTCHA v3 トークンを検証する
 *
 * @param token - クライアントから送信されたトークン
 * @param expectedAction - 期待されるアクション名
 * @param threshold - スコア閾値
 * @returns 検証結果
 */
export async function verifyRecaptcha(
  token: string,
  expectedAction?: string,
  threshold?: number,
): Promise<RecaptchaVerifyResult> {
  // reCAPTCHAが無効な場合は常に成功
  if (!RECAPTCHA_INTERNALS.enabled) {
    return { valid: true, score: 1.0 };
  }

  if (!token) {
    return { valid: false, score: 0, error: "reCAPTCHAトークンが提供されていません" };
  }

  // thresholdが指定されていない場合はスコア検証をスキップ（0以上なら通過）
  const effectiveThreshold = threshold ?? 0;

  try {
    const response = await fetch(RECAPTCHA_INTERNALS.verifyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        secret: RECAPTCHA_INTERNALS.secretKey,
        response: token,
      }),
    });

    if (!response.ok) {
      return { valid: false, score: 0, error: "reCAPTCHA検証APIへの接続に失敗しました" };
    }

    const data: RecaptchaVerifyResponse = await response.json();

    if (!data.success) {
      const errorCodes = data["error-codes"]?.join(", ") ?? "unknown";
      return { valid: false, score: 0, error: `reCAPTCHA検証エラー: ${errorCodes}` };
    }

    const score = data.score ?? 0;

    // アクション名の検証（指定されている場合）
    if (expectedAction && data.action !== expectedAction) {
      return {
        valid: false,
        score,
        error: `不正なアクション: expected=${expectedAction}, got=${data.action}`,
      };
    }

    // スコア閾値の検証
    if (score < effectiveThreshold) {
      return {
        valid: false,
        score,
        error: `スコアが閾値未満です: ${score} < ${effectiveThreshold}`,
      };
    }

    return { valid: true, score };
  } catch (error) {
    console.error("reCAPTCHA verification failed:", error);
    return { valid: false, score: 0, error: "reCAPTCHA検証中にエラーが発生しました" };
  }
}
