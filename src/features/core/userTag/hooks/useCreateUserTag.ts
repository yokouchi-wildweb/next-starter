// src/features/userTag/hooks/useCreateUserTag.ts

"use client";

import { useCreateDomain } from "@/lib/crud/hooks";
import { userTagClient } from "../services/client/userTagClient";
import type { UserTag } from "../entities";
import type { UserTagCreateFields } from "../entities/form";

export const useCreateUserTag = () =>
  useCreateDomain<UserTag, UserTagCreateFields>("userTags/create", userTagClient.create, "userTags");
