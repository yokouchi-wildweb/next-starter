// src/features/user/utils/status.ts

import {
  USER_AVAILABLE_STATUSES,
  USER_REGISTERED_STATUSES,
} from "@/constants/user";
import type { UserStatus } from "@/types/user";

const includesStatus = (
  statuses: readonly UserStatus[],
  status: string | null | undefined,
): status is UserStatus => {
  if (typeof status !== "string") {
    return false;
  }

  return (statuses as readonly string[]).includes(status);
};

export const createUserStatusChecker = (statuses: readonly UserStatus[]) =>
  (status: string | null | undefined) => includesStatus(statuses, status);

export const isUserStatusAvailable = (status: string | null | undefined) =>
  includesStatus(USER_AVAILABLE_STATUSES, status);

export const isUserStatusRegistered = (status: string | null | undefined) =>
  includesStatus(USER_REGISTERED_STATUSES, status);
