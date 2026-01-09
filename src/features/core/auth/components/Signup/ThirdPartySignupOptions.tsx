// src/features/auth/components/Signup/ThirdPartySignupOptions.tsx

"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/Form/Button/Button";
import { Block } from "@/components/Layout/Block";
import { SecTitle } from "@/components/TextBlocks";
import { OAUTH_PROVIDER_IDS } from "@/features/core/user/constants";
import { APP_FEATURES } from "@/config/app/app-features.config";

export function ThirdPartySignupOptions() {
  const router = useRouter();

  const thirdPartyConfig = APP_FEATURES.auth.thirdPartyProviders;

  const options = [
    {
      key: "google" as const,
      label: "Googleで登録",
      providerId: OAUTH_PROVIDER_IDS.google,
    },
    {
      key: "yahoo" as const,
      label: "Yahoo!で登録",
      providerId: OAUTH_PROVIDER_IDS.yahoo,
    },
    {
      key: "facebook" as const,
      label: "Facebookで登録",
      providerId: OAUTH_PROVIDER_IDS.facebook,
    },
    {
      key: "twitter" as const,
      label: "Twitterで登録",
      providerId: OAUTH_PROVIDER_IDS.twitter,
    },
  ].filter((option) => thirdPartyConfig[option.key]);

  if (options.length === 0) {
    return null;
  }

  return (
    <Block>
      <SecTitle as="h3">
        サードパーティサービスで登録
      </SecTitle>
      <div className="flex flex-col gap-3">
        {options.map((option) => (
          <Button
            key={option.key}
            type="button"
            variant="outline"
            className="w-full justify-center"
            onClick={() => router.push(`/signup/oauth?provider=${option.providerId}`)}
          >
            {option.label}
          </Button>
        ))}
      </div>
    </Block>
  );
}
