// src/domains/referral/hooks/useUpdateReferral.ts

"use client";

import { useUpdateDomain } from "@/lib/crud";
import { referralClient } from "../services/client/referralClient";
import type { Referral } from "../entities";
import type { ReferralUpdateFields } from "../entities/form";

export const useUpdateReferral = () =>
  useUpdateDomain<Referral, ReferralUpdateFields>(
    "referrals/update",
    referralClient.update,
    "referrals",
  );
