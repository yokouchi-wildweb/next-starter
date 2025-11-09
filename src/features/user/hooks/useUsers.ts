// src/features/user/hooks/useUsers.ts

"use client";

import { useDomainList } from "@/lib/crud/hooks";
import { userClient } from "../services/client/userClient";
import type { User } from "../entities";
import type { SWRConfiguration } from "swr";

export const useUsers = (config?: SWRConfiguration) =>
  useDomainList<User>("users", userClient.getAll, config);
