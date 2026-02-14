// src/features/referral/hooks/useCreateReferral.ts

"use client";

import { useCreateDomain } from "@/lib/crud/hooks";
import { referralClient } from "../services/client/referralClient";
import type { Referral } from "../entities";
import type { ReferralCreateFields } from "../entities/form";

export const useCreateReferral = () =>
  useCreateDomain<Referral, ReferralCreateFields>("referrals/create", referralClient.create, "referrals");
