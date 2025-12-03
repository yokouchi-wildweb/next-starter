// src/features/wallet/hooks/useDeleteWallet.ts

"use client";

import { useDeleteDomain } from "@/lib/crud/hooks";
import { walletClient } from "../services/client/walletClient";

export const useDeleteWallet = () => useDeleteDomain("wallets/delete", walletClient.delete, "wallets");
