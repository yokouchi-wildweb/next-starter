// src/features/referral/hooks/useReferral.ts

"use client";

import { useDomain } from "@/lib/crud/hooks";
import { referralClient } from "../services/client/referralClient";
import type { Referral } from "../entities";

export const useReferral = (id?: string | null) =>
  useDomain<Referral | undefined>(
    id ? `referral:${id}` : null,
    () => referralClient.getById(id!) as Promise<Referral>,
  );
