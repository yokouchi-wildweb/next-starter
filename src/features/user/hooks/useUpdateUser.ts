// src/features/user/hooks/useUpdateUser.ts
"use client";

import { useUpdateDomain } from "@/lib/crud/hooks";
import { userClient } from "../services/client/userClient";
import type { User } from "../entities";

export const useUpdateUser = () => useUpdateDomain<User>("users/update", userClient.update, "users");
