// src/features/userTag/hooks/useDeleteUserTag.ts

"use client";

import { useDeleteDomain } from "@/lib/crud/hooks";
import { userTagClient } from "../services/client/userTagClient";

export const useDeleteUserTag = () => useDeleteDomain("userTags/delete", userTagClient.delete, "userTags");
