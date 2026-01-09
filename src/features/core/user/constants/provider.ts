// src/features/core/user/constants/provider.ts

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
} as const satisfies Record<string, (typeof USER_PROVIDER_TYPES)[number]>;
