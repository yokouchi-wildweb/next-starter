// src/features/auth/utils/createOAuthProvider.ts

import {
  GoogleAuthProvider,
  FacebookAuthProvider,
  OAuthProvider,
  TwitterAuthProvider,
  type AuthProvider,
} from "firebase/auth";

import { OAUTH_PROVIDER_IDS } from "@/features/core/user/constants";
import type { UserProviderType } from "@/features/core/user/types";

export function createOAuthProvider(provider: UserProviderType): AuthProvider | null {
  switch (provider) {
    case OAUTH_PROVIDER_IDS.google: {
      const googleProvider = new GoogleAuthProvider();
      googleProvider.setCustomParameters({ prompt: "select_account" });
      return googleProvider;
    }
    case OAUTH_PROVIDER_IDS.yahoo: {
      const yahooProvider = new OAuthProvider(OAUTH_PROVIDER_IDS.yahoo);
      yahooProvider.addScope("profile");
      yahooProvider.addScope("email");
      return yahooProvider;
    }
    case OAUTH_PROVIDER_IDS.facebook:
      return new FacebookAuthProvider();
    case OAUTH_PROVIDER_IDS.twitter:
      return new TwitterAuthProvider();
    default:
      return null;
  }
}
