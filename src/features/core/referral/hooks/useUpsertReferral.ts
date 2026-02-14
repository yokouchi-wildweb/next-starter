// src/features/referral/hooks/useUpsertReferral.ts

"use client";

import { useUpsertDomain } from "@/lib/crud/hooks";
import { referralClient } from "../services/client/referralClient";
import type { Referral } from "../entities";
import type { ReferralCreateFields } from "../entities/form";

export const useUpsertReferral = () => {
  const upsert = referralClient.upsert;

  if (!upsert) {
    throw new Error("Referralのアップサート機能が利用できません");
  }

  return useUpsertDomain<Referral, ReferralCreateFields>(
    "referrals/upsert",
    upsert,
    "referrals",
  );
};
