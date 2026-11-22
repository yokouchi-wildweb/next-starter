// src/domains/wallet/hooks/useDeleteWallet.ts

"use client";

import { useDeleteDomain } from "@/lib/crud";
import { walletClient } from "../services/client/walletClient";

export const useDeleteWallet = () => useDeleteDomain("wallets/delete", walletClient.delete, "wallets");
