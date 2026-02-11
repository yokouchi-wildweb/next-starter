// src/features/userTag/hooks/useUpsertUserTag.ts

"use client";

import { useUpsertDomain } from "@/lib/crud/hooks";
import { userTagClient } from "../services/client/userTagClient";
import type { UserTag } from "../entities";
import type { UserTagCreateFields } from "../entities/form";

export const useUpsertUserTag = () => {
  const upsert = userTagClient.upsert;

  if (!upsert) {
    throw new Error("UserTagのアップサート機能が利用できません");
  }

  return useUpsertDomain<UserTag, UserTagCreateFields>(
    "userTags/upsert",
    upsert,
    "userTags",
  );
};
