// src/features/auth/components/Signup/ThirdPartySignupOptions.tsx

"use client";

import { useRouter } from "@/lib/unsavedGuard";
import { FaGoogle, FaYahoo, FaFacebook, FaXTwitter } from "react-icons/fa6";

import { Button } from "@/components/Button/Button";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Span } from "@/components/TextBlocks/Span";
import { OAUTH_PROVIDER_IDS } from "@/features/core/user/constants";
import { authConfig } from "@/features/auth/config";

export type ThirdPartySignupOptionsProps = {
  redirectTo?: string;
};

export function ThirdPartySignupOptions({ redirectTo }: ThirdPartySignupOptionsProps) {
  const router = useRouter();

  const thirdPartyConfig = authConfig.thirdPartyProviders;

  const options = [
    {
      key: "google" as const,
      label: "Googleでログインする",
      icon: FaGoogle,
      // eslint-disable-next-line style-tokens/no-raw-palette -- 外部サービスのブランド色(テーマに追従させない)
      iconColor: "text-[#4285F4]",
      providerId: OAUTH_PROVIDER_IDS.google,
    },
    {
      key: "yahoo" as const,
      label: "Yahoo! JAPANでログインする",
      icon: FaYahoo,
      // eslint-disable-next-line style-tokens/no-raw-palette -- 外部サービスのブランド色
      iconColor: "text-[#FF0033]",
      providerId: OAUTH_PROVIDER_IDS.yahoo,
    },
    {
      key: "facebook" as const,
      label: "Facebookでログインする",
      icon: FaFacebook,
      // eslint-disable-next-line style-tokens/no-raw-palette -- 外部サービスのブランド色
      iconColor: "text-[#1877F2]",
      providerId: OAUTH_PROVIDER_IDS.facebook,
    },
    {
      key: "twitter" as const,
      label: "Xでログインする",
      icon: FaXTwitter,
      iconColor: "text-foreground",
      providerId: OAUTH_PROVIDER_IDS.twitter,
    },
  ].filter((option) => thirdPartyConfig[option.key]);

  if (options.length === 0) {
    return null;
  }

  return (
    <Block>
      <Flex align="center" gap="md">
        <Block className="flex-1 border-t border-muted-foreground" />
        <Span size="sm" tone="muted">または</Span>
        <Block className="flex-1 border-t border-muted-foreground" />
      </Flex>
      <Stack gap="sm">
        {options.map((option) => (
          <Button
            key={option.key}
            type="button"
            variant="outline"
            className="group w-full justify-center border-muted-foreground/50"
            onClick={() => {
              const returnToParam = redirectTo ? `&returnTo=${encodeURIComponent(redirectTo)}` : "";
              router.push(`/signup/oauth?provider=${option.providerId}${returnToParam}`);
            }}
          >
            <option.icon className={`size-5 ${option.iconColor} group-hover:text-accent-foreground`} />
            <Span inline weight="normal" tone="muted" className="group-hover:text-accent-foreground">{option.label}</Span>
          </Button>
        ))}
      </Stack>
    </Block>
  );
}
