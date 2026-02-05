// src/features/core/user/hooks/useUser.ts

"use client";

import { useDomain } from "@/lib/crud/hooks";
import { userClient } from "../services/client/userClient";
import type { User } from "../entities";

export const useUser = (id?: string | null) =>
  useDomain<User | undefined>(
    id ? `user:${id}` : null,
    () => userClient.getById(id!) as Promise<User>,
  );
