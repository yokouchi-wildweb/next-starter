// src/features/user/hooks/useCreateUser.ts

"use client";

import { useCreateDomain } from "@/lib/crud/hooks";
import { userClient } from "../services/client/userClient";
import type { User } from "../entities";
import type { CreateUserInput } from "../services/types";

export const useCreateUser = () =>
  useCreateDomain<User, CreateUserInput>("users/create", userClient.create, "users");
