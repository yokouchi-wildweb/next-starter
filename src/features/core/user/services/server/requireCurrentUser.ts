// src/features/user/services/server/requireCurrentUser.ts

import { cache } from "react";
import { notFound, redirect } from "next/navigation";

import { authGuard } from "@/features/core/auth/services/server/authorization";
import type { User } from "@/features/core/user/entities/model";

import { userService } from "./userService";

type RequireCurrentUserThrowOptions = {
  behavior?: "throw";
};

type RequireCurrentUserRedirectOptions = {
  behavior: "redirect";
  redirectTo: string;
};

type RequireCurrentUserReturnNullOptions = {
  behavior: "return-null";
};

export type RequireCurrentUserOptions =
  | RequireCurrentUserThrowOptions
  | RequireCurrentUserRedirectOptions
  | RequireCurrentUserReturnNullOptions;

const fetchCurrentUser = cache(async (): Promise<User | null> => {
  const sessionUser = await authGuard();

  if (!sessionUser) {
    return null;
  }

  const user = await userService.get(sessionUser.userId);

  if (!user) {
    return null;
  }

  return user;
});

export async function requireCurrentUser(): Promise<User>;
export async function requireCurrentUser(
  options: RequireCurrentUserThrowOptions,
): Promise<User>;
export async function requireCurrentUser(
  options: RequireCurrentUserRedirectOptions,
): Promise<User>;
export async function requireCurrentUser(
  options: RequireCurrentUserReturnNullOptions,
): Promise<User | null>;
export async function requireCurrentUser(
  options: RequireCurrentUserOptions = {},
): Promise<User | null> {
  const user = await fetchCurrentUser();

  if (user) {
    return user;
  }

  if (options.behavior === "return-null") {
    return null;
  }

  if (options.behavior === "redirect") {
    redirect(options.redirectTo);
  }

  notFound();
}
