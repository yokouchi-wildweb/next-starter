// src/features/referral/hooks/useReferralList.ts

"use client";

import { useDomainList } from "@/lib/crud/hooks";
import { referralClient } from "../services/client/referralClient";
import type { Referral } from "../entities";
import type { SWRConfiguration } from "swr";

export const useReferralList = (config?: SWRConfiguration) =>
  useDomainList<Referral>("referrals", referralClient.getAll, config);
