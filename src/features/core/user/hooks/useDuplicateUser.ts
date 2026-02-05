// src/features/core/user/hooks/useDuplicateUser.ts

"use client";

import { useDuplicateDomain } from "@/lib/crud/hooks";
import { userClient } from "../services/client/userClient";

export const useDuplicateUser = () => useDuplicateDomain("users/duplicate", userClient.duplicate!, "users");
