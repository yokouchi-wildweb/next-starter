// src/features/referral/hooks/useBulkUpdateReferral.ts

"use client";

import { useBulkUpdateDomain } from "@/lib/crud/hooks";
import { referralClient } from "../services/client/referralClient";
import type { Referral } from "../entities";
import type { ReferralUpdateFields } from "../entities/form";

export const useBulkUpdateReferral = () => {
  const bulkUpdate = referralClient.bulkUpdate;

  if (!bulkUpdate) {
    throw new Error("Referralの一括更新機能が利用できません");
  }

  return useBulkUpdateDomain<Referral, ReferralUpdateFields>(
    "referrals/bulk-update",
    bulkUpdate,
    "referrals",
  );
};
