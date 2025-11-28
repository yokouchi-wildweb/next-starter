// src/features/setting/hooks/useAdminSetup.ts

"use client";

import useSWRMutation from "swr/mutation";

import type { User } from "@/features/core/user/entities";
import type { HttpError } from "@/lib/errors";

import { adminSetupClient } from "../services/client/adminSetupClient";
import type { AdminSetupInput } from "../services/types";

export const useAdminSetup = () => {
  const mutation = useSWRMutation<User, HttpError, string, AdminSetupInput>(
    "setting/setup",
    (_key, { arg }) => adminSetupClient.initialize(arg),
  );

  return {
    trigger: mutation.trigger as (arg: AdminSetupInput) => Promise<User>,
    isMutating: mutation.isMutating,
    error: mutation.error,
  };
};
