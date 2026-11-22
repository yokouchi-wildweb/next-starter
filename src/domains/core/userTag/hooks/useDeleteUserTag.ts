// src/domains/userTag/hooks/useDeleteUserTag.ts

"use client";

import { useDeleteDomain } from "@/lib/crud";
import { userTagClient } from "../services/client/userTagClient";

export const useDeleteUserTag = () => useDeleteDomain("userTags/delete", userTagClient.delete, "userTags");
