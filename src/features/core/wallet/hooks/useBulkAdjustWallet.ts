// src/features/wallet/hooks/useBulkAdjustWallet.ts

"use client";

import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";

import type { HttpError } from "@/lib/errors";
import { walletClient, type BulkAdjustByTypePayload } from "../services/client/walletClient";
import type { BulkAdjustByTypeResult } from "@/features/core/wallet/services/types";

type UseBulkAdjustWalletOptions = {
  revalidateKeys?: string | string[];
};

export const useBulkAdjustWallet = (options?: UseBulkAdjustWalletOptions) => {
  const { mutate } = useSWRConfig();

  const mutation = useSWRMutation<BulkAdjustByTypeResult, HttpError, "wallet-bulk-adjust", BulkAdjustByTypePayload>(
    "wallet-bulk-adjust",
    (_key, { arg }) => walletClient.bulkAdjustByType(arg),
    {
      onSuccess: async () => {
        if (!options?.revalidateKeys) return;
        const keys = Array.isArray(options.revalidateKeys)
          ? options.revalidateKeys
          : [options.revalidateKeys];
        await Promise.all(keys.filter(Boolean).map((key) => mutate(key)));
      },
    },
  );

  return {
    data: mutation.data,
    error: mutation.error,
    isLoading: mutation.isMutating,
    isMutating: mutation.isMutating,
    trigger: (payload: BulkAdjustByTypePayload) => mutation.trigger(payload),
  };
};
