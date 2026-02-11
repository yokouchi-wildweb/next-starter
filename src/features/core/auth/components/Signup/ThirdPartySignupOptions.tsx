// src/features/auth/components/Signup/ThirdPartySignupOptions.tsx

"use client";

import { useRouter } from "next/navigation";
import { FaGoogle, FaYahoo, FaFacebook, FaXTwitter } from "react-icons/fa6";

import { Button } from "@/components/Form/Button/Button";
import { Block } from "@/components/Layout/Block";
import { OAUTH_PROVIDER_IDS } from "@/features/core/user/constants";
import { APP_FEATURES } from "@/config/app/app-features.config";

export type ThirdPartySignupOptionsProps = {
  redirectTo?: string;
};

export function ThirdPartySignupOptions({ redirectTo }: ThirdPartySignupOptionsProps) {
  const router = useRouter();

  const thirdPartyConfig = APP_FEATURES.auth.thirdPartyProviders;

  const options = [
    {
      key: "google" as const,
      label: "Googleでログインする",
      icon: FaGoogle,
      iconColor: "text-[#4285F4]",
      providerId: OAUTH_PROVIDER_IDS.google,
    },
    {
      key: "yahoo" as const,
      label: "Yahoo! JAPANでログインする",
      icon: FaYahoo,
      iconColor: "text-[#FF0033]",
      providerId: OAUTH_PROVIDER_IDS.yahoo,
    },
    {
      key: "facebook" as const,
      label: "Facebookでログインする",
      icon: FaFacebook,
      iconColor: "text-[#1877F2]",
      providerId: OAUTH_PROVIDER_IDS.facebook,
    },
    {
      key: "twitter" as const,
      label: "Xでログインする",
      icon: FaXTwitter,
      iconColor: "text-black dark:text-white",
      providerId: OAUTH_PROVIDER_IDS.twitter,
    },
  ].filter((option) => thirdPartyConfig[option.key]);

  if (options.length === 0) {
    return null;
  }

  return (
    <Block>
      <div className="flex items-center gap-4">
        <div className="flex-1 border-t border-muted-foreground" />
        <span className="text-sm text-muted-foreground">または</span>
        <div className="flex-1 border-t border-muted-foreground" />
      </div>
      <div className="flex flex-col gap-3">
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
            <span className="font-normal text-muted-foreground group-hover:text-accent-foreground">{option.label}</span>
          </Button>
        ))}
      </div>
    </Block>
  );
}
