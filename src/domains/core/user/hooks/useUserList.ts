// src/domains/core/user/hooks/useUserList.ts

"use client";

import { useDomainList } from "@/lib/crud";
import { userClient } from "../services/client/userClient";
import type { User } from "../entities";
import type { SWRConfiguration } from "swr";

export const useUserList = (config?: SWRConfiguration) =>
  useDomainList<User>("users", userClient.getAll, config);
