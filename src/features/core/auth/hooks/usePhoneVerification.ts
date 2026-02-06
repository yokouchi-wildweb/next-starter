// src/features/core/auth/hooks/usePhoneVerification.ts

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  RecaptchaVerifier,
  linkWithPhoneNumber,
  type ConfirmationResult,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client/app";
import {
  checkPhoneAvailability,
  verifyPhone,
} from "../services/client/phoneVerification";
import {
  PHONE_VERIFICATION_RESEND_INTERVAL_SECONDS,
} from "@/features/core/user/constants";
import { formatToE164 } from "@/features/core/user/utils/phoneNumber";

export type PhoneVerificationStep = "input" | "otp" | "complete";

export type PhoneVerificationState = {
  step: PhoneVerificationStep;
  phoneNumber: string;
  isLoading: boolean;
  error: Error | null;
  resendCountdown: number;
  phoneVerifiedAt: Date | null;
};

export type UsePhoneVerificationReturn = PhoneVerificationState & {
  setPhoneNumber: (phoneNumber: string) => void;
  sendOtp: () => Promise<void>;
  verifyOtp: (otpCode: string) => Promise<void>;
  resendOtp: () => Promise<void>;
  reset: () => void;
  recaptchaContainerId: string;
};

const RECAPTCHA_CONTAINER_ID = "phone-verification-recaptcha";

// デバッグ用ログ関数
const DEBUG = true;
const debugLog = (message: string, data?: unknown) => {
  if (DEBUG) {
    console.log(`[PhoneVerification] ${message}`, data ?? "");
  }
};

/**
 * 電話番号認証フローを管理するフック（ハイブリッド方式）
 *
 * このフックは以下の2つの処理を行います：
 * 1. Firebase側: 既存ユーザーに電話番号プロバイダをリンク（MFA対応可能）
 * 2. 自前DB側: phoneNumber, phoneVerifiedAtを保存（ビジネスロジック用）
 *
 * 前提条件:
 * - ユーザーがFirebase Authでログイン済みであること
 * - 電話番号が他のユーザーに使用されていないこと
 *
 * 使用例:
 * ```tsx
 * const { step, phoneNumber, setPhoneNumber, sendOtp, verifyOtp } = usePhoneVerification();
 *
 * // Step 1: 電話番号入力
 * <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} />
 * <button onClick={sendOtp}>送信</button>
 *
 * // Step 2: OTP入力
 * <input value={otpCode} onChange={(e) => setOtpCode(e.target.value)} />
 * <button onClick={() => verifyOtp(otpCode)}>検証</button>
 * ```
 */
export function usePhoneVerification(): UsePhoneVerificationReturn {
  const [step, setStep] = useState<PhoneVerificationStep>("input");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);
  const [phoneVerifiedAt, setPhoneVerifiedAt] = useState<Date | null>(null);

  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // カウントダウンタイマーのクリーンアップ
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  // カウントダウン開始
  const startResendCountdown = useCallback(() => {
    setResendCountdown(PHONE_VERIFICATION_RESEND_INTERVAL_SECONDS);

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }

    countdownIntervalRef.current = setInterval(() => {
      setResendCountdown((prev) => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // RecaptchaVerifierの初期化
  const initRecaptchaVerifier = useCallback(() => {
    debugLog("initRecaptchaVerifier called");

    if (recaptchaVerifierRef.current) {
      debugLog("RecaptchaVerifier already exists, reusing");
      return recaptchaVerifierRef.current;
    }

    const container = document.getElementById(RECAPTCHA_CONTAINER_ID);
    debugLog("reCAPTCHA container element", {
      containerId: RECAPTCHA_CONTAINER_ID,
      exists: !!container,
      innerHTML: container?.innerHTML
    });

    debugLog("Creating new RecaptchaVerifier", {
      authApp: auth.app.name,
      authConfig: auth.config
    });

    const verifier = new RecaptchaVerifier(auth, RECAPTCHA_CONTAINER_ID, {
      size: "invisible",
      callback: () => {
        debugLog("reCAPTCHA callback: verification SUCCESS");
      },
      "expired-callback": () => {
        debugLog("reCAPTCHA callback: EXPIRED");
        setError(new Error("reCAPTCHAの有効期限が切れました。再度お試しください。"));
      },
    });

    debugLog("RecaptchaVerifier created successfully");
    recaptchaVerifierRef.current = verifier;
    return verifier;
  }, []);

  // OTP送信
  const sendOtp = useCallback(async () => {
    debugLog("sendOtp called", { phoneNumber });
    setIsLoading(true);
    setError(null);

    try {
      // ログイン中のユーザーを取得
      const currentUser = auth.currentUser;
      debugLog("currentUser check", {
        exists: !!currentUser,
        uid: currentUser?.uid,
        email: currentUser?.email,
        phoneNumber: currentUser?.phoneNumber,
        providerId: currentUser?.providerId,
      });

      if (!currentUser) {
        throw new Error("ログインが必要です");
      }

      const e164PhoneNumber = formatToE164(phoneNumber);
      debugLog("E.164 formatted phone number", { original: phoneNumber, e164: e164PhoneNumber });

      // 電話番号の重複チェック
      debugLog("Checking phone availability...");
      const { available } = await checkPhoneAvailability({
        phoneNumber: e164PhoneNumber,
      });
      debugLog("Phone availability result", { available });

      if (!available) {
        throw new Error("この電話番号は既に使用されています");
      }

      // RecaptchaVerifierを初期化
      debugLog("Initializing RecaptchaVerifier...");
      const verifier = initRecaptchaVerifier();
      debugLog("RecaptchaVerifier ready", { verifierType: verifier.type });

      // IDトークンを強制リフレッシュしてセッションを最新化
      debugLog("Refreshing ID token...");
      try {
        await currentUser.getIdToken(true);
        debugLog("ID token refreshed successfully");
      } catch (tokenError) {
        debugLog("ID token refresh failed", {
          errorMessage: tokenError instanceof Error ? tokenError.message : String(tokenError),
          errorCode: (tokenError as { code?: string })?.code,
        });
        throw new Error("認証セッションが無効です。再ログインしてください。");
      }

      // 既存ユーザーに電話番号をリンク（Firebase側にも登録される）
      debugLog("Calling linkWithPhoneNumber...", {
        userId: currentUser.uid,
        phoneNumber: e164PhoneNumber,
      });

      const confirmationResult = await linkWithPhoneNumber(
        currentUser,
        e164PhoneNumber,
        verifier
      );

      debugLog("linkWithPhoneNumber SUCCESS", {
        verificationId: confirmationResult.verificationId,
      });

      confirmationResultRef.current = confirmationResult;
      setPhoneNumber(e164PhoneNumber);
      setStep("otp");
      startResendCountdown();
    } catch (err) {
      debugLog("sendOtp ERROR", {
        errorName: err instanceof Error ? err.name : "Unknown",
        errorMessage: err instanceof Error ? err.message : String(err),
        errorCode: (err as { code?: string })?.code,
        errorDetails: err,
      });

      const error = err instanceof Error ? err : new Error("SMS送信に失敗しました");
      setError(error);

      // RecaptchaVerifierをリセット
      const verifier = recaptchaVerifierRef.current;
      if (verifier) {
        debugLog("Clearing RecaptchaVerifier after error");
        verifier.clear();
        recaptchaVerifierRef.current = null;
      }

      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [phoneNumber, initRecaptchaVerifier, startResendCountdown]);

  // OTP検証
  const verifyOtp = useCallback(async (otpCode: string) => {
    if (!confirmationResultRef.current) {
      throw new Error("先にSMSを送信してください");
    }

    setIsLoading(true);
    setError(null);

    try {
      // Firebase Phone AuthでOTP検証
      const userCredential = await confirmationResultRef.current.confirm(otpCode);

      // IDトークンを取得
      const idToken = await userCredential.user.getIdToken();

      // サーバーに検証完了を通知してDBを更新
      const result = await verifyPhone({
        phoneNumber,
        idToken,
      });

      setPhoneVerifiedAt(new Date(result.phoneVerifiedAt));
      setStep("complete");
    } catch (err) {
      const error = err instanceof Error ? err : new Error("認証コードが正しくありません");
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [phoneNumber]);

  // OTP再送信
  const resendOtp = useCallback(async () => {
    if (resendCountdown > 0) {
      return;
    }

    // RecaptchaVerifierをリセットして再初期化
    const existingVerifier = recaptchaVerifierRef.current;
    if (existingVerifier) {
      existingVerifier.clear();
      recaptchaVerifierRef.current = null;
    }

    setIsLoading(true);
    setError(null);

    try {
      // ログイン中のユーザーを取得
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("ログインが必要です");
      }

      const verifier = initRecaptchaVerifier();

      // 既存ユーザーに電話番号をリンク（再送信）
      const confirmationResult = await linkWithPhoneNumber(
        currentUser,
        phoneNumber,
        verifier
      );

      confirmationResultRef.current = confirmationResult;
      startResendCountdown();
    } catch (err) {
      const error = err instanceof Error ? err : new Error("SMS再送信に失敗しました");
      setError(error);

      // RecaptchaVerifierをリセット
      const verifier = recaptchaVerifierRef.current;
      if (verifier) {
        verifier.clear();
        recaptchaVerifierRef.current = null;
      }

      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [phoneNumber, resendCountdown, initRecaptchaVerifier, startResendCountdown]);

  // リセット
  const reset = useCallback(() => {
    setStep("input");
    setPhoneNumber("");
    setIsLoading(false);
    setError(null);
    setResendCountdown(0);
    setPhoneVerifiedAt(null);
    confirmationResultRef.current = null;

    const verifierToReset = recaptchaVerifierRef.current;
    if (verifierToReset) {
      verifierToReset.clear();
      recaptchaVerifierRef.current = null;
    }

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
    }
  }, []);

  return {
    step,
    phoneNumber,
    isLoading,
    error,
    resendCountdown,
    phoneVerifiedAt,
    setPhoneNumber,
    sendOtp,
    verifyOtp,
    resendOtp,
    reset,
    recaptchaContainerId: RECAPTCHA_CONTAINER_ID,
  };
}
