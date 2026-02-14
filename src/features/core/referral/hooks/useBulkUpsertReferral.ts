// src/features/referral/hooks/useBulkUpsertReferral.ts

"use client";

import { useBulkUpsertDomain } from "@/lib/crud/hooks";
import { referralClient } from "../services/client/referralClient";
import type { Referral } from "../entities";
import type { ReferralCreateFields } from "../entities/form";

export const useBulkUpsertReferral = () => {
  const bulkUpsert = referralClient.bulkUpsert;

  if (!bulkUpsert) {
    throw new Error("Referralの一括アップサート機能が利用できません");
  }

  return useBulkUpsertDomain<Referral, ReferralCreateFields>(
    "referrals/bulk-upsert",
    bulkUpsert,
    "referrals",
  );
};
