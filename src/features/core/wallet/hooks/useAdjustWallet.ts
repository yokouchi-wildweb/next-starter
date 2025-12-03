// src/features/wallet/hooks/useAdjustWallet.ts

"use client";

import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";

import type { HttpError } from "@/lib/errors";
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
  revalidateKeys?: string | string[];
};

export const useAdjustWallet = (options?: UseAdjustWalletOptions) => {
  const { mutate } = useSWRConfig();

  const mutation = useSWRMutation<WalletAdjustmentResult, HttpError, "wallet-adjust", AdjustWalletArgs>(
    "wallet-adjust",
    (_key, { arg }) => walletClient.adjustBalance(arg.userId, arg.payload),
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
    trigger: (args: AdjustWalletArgs) => mutation.trigger(args),
  };
};
