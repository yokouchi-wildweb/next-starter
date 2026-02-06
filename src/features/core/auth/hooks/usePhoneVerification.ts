// src/features/core/auth/hooks/usePhoneVerification.ts

"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  RecaptchaVerifier,
  signInWithPhoneNumber,
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

/**
 * 電話番号認証フローを管理するフック
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
    if (recaptchaVerifierRef.current) {
      return recaptchaVerifierRef.current;
    }

    const verifier = new RecaptchaVerifier(auth, RECAPTCHA_CONTAINER_ID, {
      size: "invisible",
      callback: () => {
        // reCAPTCHA検証成功時のコールバック
      },
      "expired-callback": () => {
        // reCAPTCHA期限切れ時のコールバック
        setError(new Error("reCAPTCHAの有効期限が切れました。再度お試しください。"));
      },
    });

    recaptchaVerifierRef.current = verifier;
    return verifier;
  }, []);

  // OTP送信
  const sendOtp = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const e164PhoneNumber = formatToE164(phoneNumber);

      // 電話番号の重複チェック
      const { available } = await checkPhoneAvailability({
        phoneNumber: e164PhoneNumber,
      });

      if (!available) {
        throw new Error("この電話番号は既に使用されています");
      }

      // RecaptchaVerifierを初期化
      const verifier = initRecaptchaVerifier();

      // Firebase Phone AuthでOTP送信
      const confirmationResult = await signInWithPhoneNumber(
        auth,
        e164PhoneNumber,
        verifier
      );

      confirmationResultRef.current = confirmationResult;
      setPhoneNumber(e164PhoneNumber);
      setStep("otp");
      startResendCountdown();
    } catch (err) {
      const error = err instanceof Error ? err : new Error("SMS送信に失敗しました");
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
      const verifier = initRecaptchaVerifier();

      const confirmationResult = await signInWithPhoneNumber(
        auth,
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
