// src/constants/user.ts

import type { UserProviderType, UserStatus } from "@/types/user";

export const USER_PROVIDER_TYPES = [
  "email",
  "local",
  "google.com",
  "yahoo.com",
  "github",
  "apple",
  "microsoft",
  "facebook.com",
  "twitter.com",
  "line",
  "oidc",
  "saml",
  "custom",
] as const;

export const OAUTH_PROVIDER_IDS = {
  google: "google.com",
  yahoo: "yahoo.com",
  facebook: "facebook.com",
  twitter: "twitter.com",
} as const satisfies Record<string, UserProviderType>;

export const USER_ROLES = ["admin", "user"] as const;

export const USER_ROLE_OPTIONS = [
  { id: "admin", name: "管理者" },
  { id: "user", name: "一般" },
] as const;

export const USER_STATUSES = [
  "pending",
  "active",
  "inactive",
  "suspended",
  "banned",
  "security_locked",
  "withdrawn",
] as const;

export const USER_AVAILABLE_STATUSES: readonly UserStatus[] = ["active"];

export const USER_REGISTERED_STATUSES: readonly UserStatus[] = [
  "active",
  "inactive",
  "suspended",
  "banned",
  "security_locked",
];
