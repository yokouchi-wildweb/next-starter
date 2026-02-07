// src/features/core/auth/hooks/usePhoneVerificationModal.ts

"use client";

import { useState, useCallback, useRef } from "react";
import type { PhoneVerificationMode } from "./usePhoneVerification";

export type PhoneVerificationResult = {
  phoneNumber: string;
  phoneVerifiedAt: Date;
};

export type RequireVerificationOptions = {
  /** 認証モード（デフォルト: "register"） */
  mode?: PhoneVerificationMode;
  /** 変更モード時の現在の電話番号 */
  currentPhoneNumber?: string | null;
};

export type UsePhoneVerificationModalReturn = {
  /** モーダルの開閉状態 */
  isOpen: boolean;
  /** モーダルを開く */
  open: (options?: RequireVerificationOptions) => void;
  /** モーダルを閉じる */
  close: () => void;
  /** 認証モード */
  mode: PhoneVerificationMode;
  /** 現在の電話番号（変更モード時） */
  currentPhoneNumber: string | null;
  /** 認証完了時のハンドラ（PhoneVerificationModalに渡す） */
  handleComplete: (result: PhoneVerificationResult) => void;
  /** キャンセル時のハンドラ（PhoneVerificationModalに渡す） */
  handleCancel: () => void;
  /** 開閉状態変更ハンドラ（PhoneVerificationModalに渡す） */
  handleOpenChange: (open: boolean) => void;
  /**
   * 認証を要求する（Promise based API）
   *
   * モーダルを開き、認証完了またはキャンセルまで待機する。
   * 認証完了時はtrue、キャンセル時はfalseを返す。
   *
   * @example
   * ```tsx
   * const handlePurchase = async () => {
   *   const verified = await requireVerification();
   *   if (!verified) return;
   *   // 購入処理...
   * };
   * ```
   */
  requireVerification: (options?: RequireVerificationOptions) => Promise<boolean>;
  /**
   * 認証を要求し、結果を取得する（Promise based API）
   *
   * 認証完了時は結果オブジェクト、キャンセル時はnullを返す。
   */
  requireVerificationWithResult: (options?: RequireVerificationOptions) => Promise<PhoneVerificationResult | null>;
};

/**
 * 電話番号認証モーダルを管理するフック
 *
 * PhoneVerificationModalと組み合わせて使用する。
 * Promise based APIで認証フローを簡単に実装できる。
 *
 * @example
 * ```tsx
 * function CoinPurchasePage({ user }) {
 *   const phoneModal = usePhoneVerificationModal();
 *
 *   const handlePurchase = async () => {
 *     // 未認証の場合、認証を要求
 *     if (!user.phoneVerifiedAt) {
 *       const verified = await phoneModal.requireVerification();
 *       if (!verified) return; // キャンセルされた
 *     }
 *     // 購入処理...
 *   };
 *
 *   return (
 *     <>
 *       <Button onClick={handlePurchase}>購入する</Button>
 *
 *       <PhoneVerificationModal
 *         open={phoneModal.isOpen}
 *         onOpenChange={phoneModal.handleOpenChange}
 *         mode={phoneModal.mode}
 *         currentPhoneNumber={phoneModal.currentPhoneNumber}
 *         onComplete={phoneModal.handleComplete}
 *         onCancel={phoneModal.handleCancel}
 *       />
 *     </>
 *   );
 * }
 * ```
 */
export function usePhoneVerificationModal(): UsePhoneVerificationModalReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<PhoneVerificationMode>("register");
  const [currentPhoneNumber, setCurrentPhoneNumber] = useState<string | null>(null);

  // Promise resolverを保持
  const resolverRef = useRef<{
    resolve: (result: PhoneVerificationResult | null) => void;
  } | null>(null);

  const open = useCallback((options?: RequireVerificationOptions) => {
    setMode(options?.mode ?? "register");
    setCurrentPhoneNumber(options?.currentPhoneNumber ?? null);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleComplete = useCallback((result: PhoneVerificationResult) => {
    setIsOpen(false);
    resolverRef.current?.resolve(result);
    resolverRef.current = null;
  }, []);

  const handleCancel = useCallback(() => {
    setIsOpen(false);
    resolverRef.current?.resolve(null);
    resolverRef.current = null;
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      handleCancel();
    } else {
      setIsOpen(true);
    }
  }, [handleCancel]);

  const requireVerificationWithResult = useCallback(
    (options?: RequireVerificationOptions): Promise<PhoneVerificationResult | null> => {
      return new Promise((resolve) => {
        resolverRef.current = { resolve };
        open(options);
      });
    },
    [open]
  );

  const requireVerification = useCallback(
    async (options?: RequireVerificationOptions): Promise<boolean> => {
      const result = await requireVerificationWithResult(options);
      return result !== null;
    },
    [requireVerificationWithResult]
  );

  return {
    isOpen,
    open,
    close,
    mode,
    currentPhoneNumber,
    handleComplete,
    handleCancel,
    handleOpenChange,
    requireVerification,
    requireVerificationWithResult,
  };
}
