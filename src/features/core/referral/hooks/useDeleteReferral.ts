// src/features/referral/hooks/useDeleteReferral.ts

"use client";

import { useDeleteDomain } from "@/lib/crud/hooks";
import { referralClient } from "../services/client/referralClient";

export const useDeleteReferral = () => useDeleteDomain("referrals/delete", referralClient.delete, "referrals");
