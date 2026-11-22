// src/domains/user/hooks/useStatusChecker.ts

"use client";

import { useMemo } from "react";

import {
  USER_AVAILABLE_STATUSES,
  USER_REGISTERED_STATUSES,
} from "@/domains/core/user/constants";
import type { UserStatus } from "@/domains/core/user/types";
import {
  createUserStatusChecker,
  isUserStatusAvailable,
  isUserStatusRegistered,
} from "@/domains/core/user/utils/status";

import type { User } from "../entities";

type StatusCheckTarget = User | UserStatus;
type NullableStatusCheckTarget = StatusCheckTarget | null;

const resolveStatus = (target: StatusCheckTarget): UserStatus =>
  typeof target === "string" ? target : target.status;

const createStatusChecker = (statuses: readonly UserStatus[]) => {
  const checkStatus = createUserStatusChecker(statuses);

  return (target: NullableStatusCheckTarget) =>
    target == null ? false : checkStatus(resolveStatus(target));
};

export const useStatusChecker = () =>
  useMemo(
    () => ({
      isAvailable: createStatusChecker(USER_AVAILABLE_STATUSES),
      isRegistered: createStatusChecker(USER_REGISTERED_STATUSES),
      isAvailableStatus: isUserStatusAvailable,
      isRegisteredStatus: isUserStatusRegistered,
    }),
    [],
  );
