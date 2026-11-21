// src/features/core/user/hooks/useUser.ts

"use client";

import { useDomain } from "@/lib/crud";
import { userClient } from "../services/client/userClient";
import type { User } from "../entities";

export const useUser = (id?: string | null) =>
  useDomain<User | undefined>(
    id ? `user:${id}` : null,
    () => userClient.get(id!) as Promise<User>,
  );
