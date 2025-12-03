// src/features/wallet/hooks/useWalletList.ts

"use client";

import { useDomainList } from "@/lib/crud/hooks";
import { walletClient } from "../services/client/walletClient";
import type { Wallet } from "../entities";
import type { SWRConfiguration } from "swr";

export const useWalletList = (config?: SWRConfiguration) =>
  useDomainList<Wallet>("wallets", walletClient.getAll, config);
