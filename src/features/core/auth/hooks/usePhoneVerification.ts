// src/features/core/auth/hooks/usePhoneVerification.ts

"use client";

import { useState, useCallback, useRef } from "react";
import {
  RecaptchaVerifier,
  linkWithPhoneNumber,
  PhoneAuthProvider,
  linkWithCredential,
  unlink,
  onAuthStateChanged,
  type ConfirmationResult,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase/client/app";
import {
  checkPhoneAvailability,
  verifyPhone,
} from "../services/client/phoneVerification";
import { formatToE164 } from "@/features/core/user/utils/phoneNumber";

export type PhoneVerificationStep = "input" | "otp" | "complete";

export type PhoneVerificationMode = "register" | "change";

export type PhoneVerificationState = {
  step: PhoneVerificationStep;
  phoneNumber: string;
  isLoading: boolean;
  error: Error | null;
  phoneVerifiedAt: Date | null;
};

export type UsePhoneVerificationOptions = {
  /** 認証モード: "register" = 新規登録, "change" = 番号変更 */
  mode?: PhoneVerificationMode;
  /** 変更モード時の現在の電話番号 */
  currentPhoneNumber?: string | null;
};

export type UsePhoneVerificationReturn = PhoneVerificationState & {
  setPhoneNumber: (phoneNumber: string) => void;
  sendOtp: () => Promise<void>;
  verifyOtp: (otpCode: string) => Promise<void>;
  resendOtp: () => Promise<void>;
  reset: () => void;
  recaptchaContainerId: string;
  /** 現在のモード */
  mode: PhoneVerificationMode;
  /** 変更モード時の現在の電話番号 */
  currentPhoneNumber: string | null;
};

const RECAPTCHA_CONTAINER_ID = "phone-verification-recaptcha";

// Firebase Auth準備完了のタイムアウト（ミリ秒）
const FIREBASE_AUTH_READY_TIMEOUT = 5000;

// デバッグ用ログ関数
const DEBUG = true;
const debugLog = (message: string, data?: unknown) => {
  if (DEBUG) {
    console.log(`[PhoneVerification] ${message}`, data ?? "");
  }
};

/**
 * Firebase Authが準備完了するまで待機し、現在のユーザーを返す
 * サインアップ直後など、useFirebaseAuthSyncの同期完了前に呼び出された場合に対応
 */
const waitForFirebaseAuth = (): Promise<User> => {
  return new Promise((resolve, reject) => {
    // すでにユーザーが存在する場合は即座に返す
    if (auth.currentUser) {
      debugLog("Firebase Auth already has currentUser");
      resolve(auth.currentUser);
      return;
    }

    debugLog("Waiting for Firebase Auth to be ready...");

    const timeoutId = setTimeout(() => {
      unsubscribe();
      reject(new Error("認証の準備がタイムアウトしました。ページを再読み込みしてください。"));
    }, FIREBASE_AUTH_READY_TIMEOUT);

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        clearTimeout(timeoutId);
        unsubscribe();
        debugLog("Firebase Auth is ready", { uid: user.uid });
        resolve(user);
      }
    });
  });
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
export function usePhoneVerification(
  options: UsePhoneVerificationOptions = {}
): UsePhoneVerificationReturn {
  const { mode = "register", currentPhoneNumber: currentPhoneNumberProp = null } = options;

  const [step, setStep] = useState<PhoneVerificationStep>("input");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [phoneVerifiedAt, setPhoneVerifiedAt] = useState<Date | null>(null);

  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
  // 変更モード用: verificationIdを保持
  const verificationIdRef = useRef<string | null>(null);

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
    debugLog("sendOtp called", { phoneNumber, mode });
    setIsLoading(true);
    setError(null);

    try {
      // Firebase Authが準備完了するまで待機してユーザーを取得
      // サインアップ直後など、useFirebaseAuthSyncの同期完了前でも対応可能
      let currentUser: User;
      try {
        currentUser = await waitForFirebaseAuth();
      } catch (authError) {
        debugLog("waitForFirebaseAuth failed", {
          errorMessage: authError instanceof Error ? authError.message : String(authError),
        });
        throw authError;
      }

      debugLog("currentUser check", {
        exists: !!currentUser,
        uid: currentUser?.uid,
        email: currentUser?.email,
        phoneNumber: currentUser?.phoneNumber,
        providerId: currentUser?.providerId,
      });

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

      // ユーザー情報を最新化してからIDトークンをリフレッシュ
      debugLog("Reloading user and refreshing ID token...");
      try {
        // サインアップ直後など、Firebase Authの状態が完全に同期されていない場合に対応
        await currentUser.reload();
        debugLog("User reloaded successfully");
        await currentUser.getIdToken(true);
        debugLog("ID token refreshed successfully");
      } catch (tokenError) {
        debugLog("User reload or ID token refresh failed", {
          errorMessage: tokenError instanceof Error ? tokenError.message : String(tokenError),
          errorCode: (tokenError as { code?: string })?.code,
        });
        throw new Error("認証セッションが無効です。再ログインしてください。");
      }

      if (mode === "change") {
        // 変更モード: PhoneAuthProvider.verifyPhoneNumberを使用
        // OTP検証後にunlink→linkWithCredentialを行う
        debugLog("Calling PhoneAuthProvider.verifyPhoneNumber (change mode)...", {
          userId: currentUser.uid,
          phoneNumber: e164PhoneNumber,
        });

        const provider = new PhoneAuthProvider(auth);
        const verificationId = await provider.verifyPhoneNumber(
          e164PhoneNumber,
          verifier
        );

        debugLog("verifyPhoneNumber SUCCESS", { verificationId });

        verificationIdRef.current = verificationId;
        confirmationResultRef.current = null;
      } else {
        // 登録モード: linkWithPhoneNumberを使用
        debugLog("Calling linkWithPhoneNumber (register mode)...", {
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
        verificationIdRef.current = null;
      }

      setPhoneNumber(e164PhoneNumber);
      setStep("otp");
    } catch (err) {
      debugLog("sendOtp ERROR", {
        errorName: err instanceof Error ? err.name : "Unknown",
        errorMessage: err instanceof Error ? err.message : String(err),
        errorCode: (err as { code?: string })?.code,
        errorDetails: err,
      });

      // エラーメッセージを日本語に変換
      let errorMessage = "SMS送信に失敗しました";
      const errMessage = err instanceof Error ? err.message : String(err);

      if (errMessage.includes("reCAPTCHA has already been rendered")) {
        errorMessage = "ページを再読み込みして、もう一度お試しください。";
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }

      const error = new Error(errorMessage);
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
  }, [phoneNumber, mode, initRecaptchaVerifier]);

  // OTP検証
  const verifyOtp = useCallback(async (otpCode: string) => {
    debugLog("verifyOtp called", { mode, hasConfirmationResult: !!confirmationResultRef.current, hasVerificationId: !!verificationIdRef.current });

    setIsLoading(true);
    setError(null);

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("ログインが必要です");
      }

      if (mode === "change") {
        // 変更モード: verificationIdを使用してcredentialを作成
        if (!verificationIdRef.current) {
          throw new Error("先にSMSを送信してください");
        }

        debugLog("Creating PhoneAuthCredential (change mode)...");
        const credential = PhoneAuthProvider.credential(
          verificationIdRef.current,
          otpCode
        );

        // 既存の電話番号プロバイダをアンリンク
        debugLog("Unlinking existing phone provider...");
        try {
          await unlink(currentUser, PhoneAuthProvider.PROVIDER_ID);
          debugLog("Unlink SUCCESS");
        } catch (unlinkError) {
          // 電話番号が紐づいていない場合はスキップ
          debugLog("Unlink skipped or failed (may not have phone linked)", {
            errorCode: (unlinkError as { code?: string })?.code,
          });
        }

        // 新しい電話番号をリンク
        debugLog("Linking new phone credential...");
        const userCredential = await linkWithCredential(currentUser, credential);
        debugLog("linkWithCredential SUCCESS");

        // IDトークンを取得
        const idToken = await userCredential.user.getIdToken();

        // サーバーに検証完了を通知してDBを更新
        const result = await verifyPhone({
          phoneNumber,
          idToken,
        });

        setPhoneVerifiedAt(new Date(result.phoneVerifiedAt));
        setStep("complete");
      } else {
        // 登録モード: confirmationResultを使用
        if (!confirmationResultRef.current) {
          throw new Error("先にSMSを送信してください");
        }

        debugLog("Confirming OTP (register mode)...");
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
      }
    } catch (err) {
      debugLog("verifyOtp ERROR", {
        errorName: err instanceof Error ? err.name : "Unknown",
        errorMessage: err instanceof Error ? err.message : String(err),
        errorCode: (err as { code?: string })?.code,
      });

      const error = err instanceof Error ? err : new Error("認証コードが正しくありません");
      setError(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [phoneNumber, mode]);

  // OTP再送信
  const resendOtp = useCallback(async () => {
    debugLog("resendOtp called", { mode, phoneNumber });

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

      if (mode === "change") {
        // 変更モード: PhoneAuthProvider.verifyPhoneNumberを使用
        debugLog("Resending with PhoneAuthProvider.verifyPhoneNumber (change mode)...");
        const provider = new PhoneAuthProvider(auth);
        const verificationId = await provider.verifyPhoneNumber(
          phoneNumber,
          verifier
        );

        verificationIdRef.current = verificationId;
        confirmationResultRef.current = null;
      } else {
        // 登録モード: linkWithPhoneNumberを使用
        debugLog("Resending with linkWithPhoneNumber (register mode)...");
        const confirmationResult = await linkWithPhoneNumber(
          currentUser,
          phoneNumber,
          verifier
        );

        confirmationResultRef.current = confirmationResult;
        verificationIdRef.current = null;
      }

    } catch (err) {
      debugLog("resendOtp ERROR", {
        errorMessage: err instanceof Error ? err.message : String(err),
        errorCode: (err as { code?: string })?.code,
      });

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
  }, [phoneNumber, mode, initRecaptchaVerifier]);

  // リセット
  const reset = useCallback(() => {
    setStep("input");
    setPhoneNumber("");
    setIsLoading(false);
    setError(null);
    setPhoneVerifiedAt(null);
    confirmationResultRef.current = null;
    verificationIdRef.current = null;

    const verifierToReset = recaptchaVerifierRef.current;
    if (verifierToReset) {
      verifierToReset.clear();
      recaptchaVerifierRef.current = null;
    }
  }, []);

  return {
    step,
    phoneNumber,
    isLoading,
    error,
    phoneVerifiedAt,
    setPhoneNumber,
    sendOtp,
    verifyOtp,
    resendOtp,
    reset,
    recaptchaContainerId: RECAPTCHA_CONTAINER_ID,
    mode,
    currentPhoneNumber: currentPhoneNumberProp,
  };
}
