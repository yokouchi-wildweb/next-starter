// src/lib/recaptcha/hooks/useRecaptchaV2Challenge.ts

"use client";

import { useState, useCallback } from "react";
import { AxiosError } from "axios";

/**
 * v2チャレンジが必要なAPIレスポンス
 */
type V2ChallengeResponse = {
  message: string;
  requireV2Challenge: true;
  recaptchaV2SiteKey: string;
};

/**
 * v2チャレンジの状態
 */
type RecaptchaV2ChallengeState = {
  /** v2チャレンジモーダルを表示中か */
  isOpen: boolean;
  /** v2サイトキー */
  siteKey: string | null;
  /** v2認証成功後のトークン */
  v2Token: string | null;
};

/**
 * APIエラーがv2チャレンジ要求かどうかを判定
 */
export function isV2ChallengeRequired(error: unknown): error is AxiosError<V2ChallengeResponse> {
  if (!(error instanceof AxiosError)) return false;
  if (error.response?.status !== 428) return false;
  return error.response?.data?.requireV2Challenge === true;
}

/**
 * v2チャレンジ要求からサイトキーを取得
 */
export function getV2SiteKey(error: AxiosError<V2ChallengeResponse>): string {
  return error.response?.data?.recaptchaV2SiteKey ?? "";
}

/**
 * reCAPTCHA v2チャレンジを管理するフック
 *
 * @example
 * ```tsx
 * const {
 *   challengeState,
 *   handleV2ChallengeRequired,
 *   handleV2Verify,
 *   closeChallenge,
 *   getV2TokenHeader,
 * } = useRecaptchaV2Challenge();
 *
 * const onSubmit = async () => {
 *   try {
 *     await api.post("/endpoint", data, {
 *       headers: getV2TokenHeader(),
 *     });
 *   } catch (error) {
 *     if (isV2ChallengeRequired(error)) {
 *       handleV2ChallengeRequired(error);
 *       return;
 *     }
 *     throw error;
 *   }
 * };
 *
 * // v2認証成功後は自動的にv2Tokenがセットされ、再送信時にヘッダーに含まれる
 * ```
 */
export function useRecaptchaV2Challenge() {
  const [challengeState, setChallengeState] = useState<RecaptchaV2ChallengeState>({
    isOpen: false,
    siteKey: null,
    v2Token: null,
  });

  /**
   * v2チャレンジが必要なエラーを受け取り、モーダルを表示
   */
  const handleV2ChallengeRequired = useCallback((error: AxiosError<V2ChallengeResponse>) => {
    const siteKey = getV2SiteKey(error);
    setChallengeState({
      isOpen: true,
      siteKey,
      v2Token: null,
    });
  }, []);

  /**
   * v2認証成功時のコールバック
   */
  const handleV2Verify = useCallback((token: string) => {
    setChallengeState((prev) => ({
      ...prev,
      isOpen: false,
      v2Token: token,
    }));
  }, []);

  /**
   * モーダルを閉じる
   */
  const closeChallenge = useCallback(() => {
    setChallengeState((prev) => ({
      ...prev,
      isOpen: false,
    }));
  }, []);

  /**
   * v2トークンをリセット
   */
  const resetV2Token = useCallback(() => {
    setChallengeState((prev) => ({
      ...prev,
      v2Token: null,
    }));
  }, []);

  /**
   * v2トークンをヘッダーとして取得
   * v2トークンがある場合のみヘッダーに含める
   */
  const getV2TokenHeader = useCallback((): Record<string, string> => {
    if (!challengeState.v2Token) return {};
    return { "X-Recaptcha-V2-Token": challengeState.v2Token };
  }, [challengeState.v2Token]);

  return {
    /** チャレンジの状態 */
    challengeState,
    /** v2チャレンジが必要なエラーを処理 */
    handleV2ChallengeRequired,
    /** v2認証成功時のコールバック */
    handleV2Verify,
    /** モーダルを閉じる */
    closeChallenge,
    /** v2トークンをリセット */
    resetV2Token,
    /** v2トークンヘッダーを取得 */
    getV2TokenHeader,
    /** v2トークンがあるか */
    hasV2Token: !!challengeState.v2Token,
  };
}
