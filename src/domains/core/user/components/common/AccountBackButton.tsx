// src/domains/core/user/components/common/AccountBackButton.tsx

import { Link } from "@/components/Navigation/Link";
import { InBlock } from "@/components/Layout/InBlock";
import { ArrowLeftIcon } from "lucide-react";

type AccountBackButtonProps = {
  href: string;
  disabled?: boolean;
};

export function AccountBackButton({ href, disabled }: AccountBackButtonProps) {
  if (disabled) {
    return (
      <InBlock
        className="flex h-9 w-9 items-center justify-center rounded-full opacity-50"
        aria-label="戻る"
      >
        <ArrowLeftIcon className="h-5 w-5 text-foreground" />
      </InBlock>
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
