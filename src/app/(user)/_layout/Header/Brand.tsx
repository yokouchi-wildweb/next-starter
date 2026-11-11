"use client";

import Image from "next/image";
import { Link } from "@/components/Navigation";

import { business } from "@/business";
import { userLayoutConfig } from "../config";
import { logoPath } from "@/utils/assets";

export const Brand = () => {
  const hasLogo = (business.logo.variants.default as string) !== "";

  return (
    <Link
      data-slot="header-brand"
      href={userLayoutConfig.header.logoLink}
      className="flex items-center gap-2.5 text-base font-semibold sm:gap-3 sm:text-lg"
    >
      {hasLogo ? (
        <Image
          data-slot="header-brand-logo"
          src={logoPath(business.logo)}
          alt={business.serviceNameShort}
          width={160}
          height={40}
          className="h-9 w-auto sm:h-10"
          priority
        />
      ) : (
        <span data-slot="header-brand-text" className="text-base font-semibold sm:text-lg">
          {business.serviceNameShort}
        </span>
      )}
    </Link>
  );
};
