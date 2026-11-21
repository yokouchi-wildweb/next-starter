// src/features/core/user/hooks/useRestoreUser.ts

"use client";

import { useRestoreDomain } from "@/lib/crud";
import { userClient } from "../services/client/userClient";

export const useRestoreUser = () => useRestoreDomain("users/restore", userClient.restore!, "users");
