// src/domains/userTag/hooks/useUserTagList.ts

"use client";

import { useDomainList } from "@/lib/crud";
import { userTagClient } from "../services/client/userTagClient";
import type { UserTag } from "../entities";
import type { SWRConfiguration } from "swr";

export const useUserTagList = (config?: SWRConfiguration) =>
  useDomainList<UserTag>("userTags", userTagClient.getAll, config);
