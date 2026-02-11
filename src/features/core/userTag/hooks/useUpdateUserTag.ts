// src/features/userTag/hooks/useUpdateUserTag.ts

"use client";

import { useUpdateDomain } from "@/lib/crud/hooks";
import { userTagClient } from "../services/client/userTagClient";
import type { UserTag } from "../entities";
import type { UserTagUpdateFields } from "../entities/form";

export const useUpdateUserTag = () =>
  useUpdateDomain<UserTag, UserTagUpdateFields>(
    "userTags/update",
    userTagClient.update,
    "userTags",
  );
