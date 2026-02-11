// src/features/userTag/hooks/useUserTag.ts

"use client";

import { useDomain } from "@/lib/crud/hooks";
import { userTagClient } from "../services/client/userTagClient";
import type { UserTag } from "../entities";

export const useUserTag = (id?: string | null) =>
  useDomain<UserTag | undefined>(
    id ? `userTag:${id}` : null,
    () => userTagClient.getById(id!) as Promise<UserTag>,
  );
