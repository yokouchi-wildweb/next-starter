// src/features/referral/hooks/useReferral.ts

"use client";

import { useDomain } from "@/lib/crud";
import { referralClient } from "../services/client/referralClient";
import type { Referral } from "../entities";

export const useReferral = (id?: string | null) =>
  useDomain<Referral | undefined>(
    id ? `referral:${id}` : null,
    () => referralClient.get(id!) as Promise<Referral>,
  );
