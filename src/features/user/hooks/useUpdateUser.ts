// src/features/user/hooks/useUpdateUser.ts
"use client";

import { useUpdateDomain } from "@/lib/crud/hooks";
import { userClient } from "../services/client/userClient";
import type { User } from "../entities";
import type { UpdateUserInput } from "../services/types";

export const useUpdateUser = () =>
  useUpdateDomain<User, UpdateUserInput>("users/update", userClient.update, "users");
