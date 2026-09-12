// src/features/wallet/hooks/useAdjustWallet.ts

"use client";

import { useDomainMutation } from "@/lib/crud/hooks";
import { walletClient } from "../services/client/walletClient";
import type {
  WalletAdjustmentResult,
  WalletAdjustRequestPayload,
} from "@/features/core/wallet/services/types";

type AdjustWalletArgs = {
  userId: string;
  payload: WalletAdjustRequestPayload;
};

type UseAdjustWalletOptions = {
  /** 成功時に再検証するキー（完全一致の文字列キー + 同プレフィックスの配列キー） */
  revalidateKeys?: string | string[];
};

/**
 * ウォレット残高を調整するフック（管理者操作）
 * 並列 trigger 安全（lib/crud/hooks/internal/useDomainMutation に準拠）
 */
export const useAdjustWallet = (options?: UseAdjustWalletOptions) => {
  const mutation = useDomainMutation<WalletAdjustmentResult, AdjustWalletArgs>(
    "wallet-adjust",
    (args) => walletClient.adjustBalance(args.userId, args.payload),
    options?.revalidateKeys,
  );

  return {
    data: mutation.data,
    error: mutation.error,
    isLoading: mutation.isMutating,
    isMutating: mutation.isMutating,
    trigger: mutation.trigger,
  };
};
