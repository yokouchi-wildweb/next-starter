// src/domains/user/hooks/useDeleteUser.ts

"use client";

import { useDeleteDomain } from "@/lib/crud";
import { userClient } from "../services/client/userClient";

export const useDeleteUser = () => useDeleteDomain("users/delete", userClient.delete, "users");
