// src/features/wallet/hooks/useBulkAdjustWallet.ts

"use client";

import { useDomainMutation } from "@/lib/crud/hooks";
import { walletClient, type BulkAdjustByTypePayload } from "../services/client/walletClient";
import type { BulkAdjustByTypeResult } from "@/features/core/wallet/services/types";

type UseBulkAdjustWalletOptions = {
  /** 成功時に再検証するキー（完全一致の文字列キー + 同プレフィックスの配列キー） */
  revalidateKeys?: string | string[];
};

/**
 * ウォレット種別ごとの一括残高調整フック（管理者操作）
 * 並列 trigger 安全（lib/crud/hooks/internal/useDomainMutation に準拠）
 */
export const useBulkAdjustWallet = (options?: UseBulkAdjustWalletOptions) => {
  const mutation = useDomainMutation<BulkAdjustByTypeResult, BulkAdjustByTypePayload>(
    "wallet-bulk-adjust",
    (payload) => walletClient.bulkAdjustByType(payload),
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
