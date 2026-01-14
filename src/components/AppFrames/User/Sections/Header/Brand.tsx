"use client";

import Image from "next/image";
import Link from "next/link";

import { businessConfig } from "@/config/business.config";
import { HEADER_LOGO_LINK } from "@/config/ui/user-header.config";
import { logoPath } from "@/utils/assets";

export const Brand = () => {
  const hasLogo = (businessConfig.logo.variants.default as string) !== "";

  return (
    <Link
      id="header-brand"
      href={HEADER_LOGO_LINK}
      className="flex items-center gap-2.5 text-base font-semibold sm:gap-3 sm:text-lg"
    >
      {hasLogo ? (
        <Image
          id="header-brand-logo"
          src={logoPath()}
          alt={businessConfig.serviceNameShort}
          width={160}
          height={40}
          className="h-9 w-auto sm:h-10"
          priority
        />
      ) : (
        <span id="header-brand-text" className="text-base font-semibold sm:text-lg">
          {businessConfig.serviceNameShort}
        </span>
      )}
    </Link>
  );
};
