// src/features/core/user/hooks/useHardDeleteUser.ts

"use client";

import { useHardDeleteDomain } from "@/lib/crud/hooks";
import { userClient } from "../services/client/userClient";

export const useHardDeleteUser = () =>
  useHardDeleteDomain("users/hard-delete", (id) => userClient.hardDelete!(id), "users");
