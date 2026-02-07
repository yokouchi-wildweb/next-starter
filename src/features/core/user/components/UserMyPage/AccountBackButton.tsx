// src/features/core/user/components/UserMyPage/AccountBackButton.tsx

import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

type AccountBackButtonProps = {
  href: string;
  disabled?: boolean;
};

export function AccountBackButton({ href, disabled }: AccountBackButtonProps) {
  if (disabled) {
    return (
      <span
        className="flex h-9 w-9 items-center justify-center rounded-full opacity-50"
        aria-label="戻る"
      >
        <ArrowLeftIcon className="h-5 w-5 text-foreground" />
      </span>
    );
  }

  return (
    <Link
      href={href}
      className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="戻る"
    >
      <ArrowLeftIcon className="h-5 w-5 text-foreground" />
    </Link>
  );
}
