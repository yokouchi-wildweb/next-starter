// src/features/core/user/components/UserMyPage/AccountPageHeader.tsx

import { SecTitle } from "@/components/TextBlocks";

import { AccountBackButton } from "./AccountBackButton";

type AccountPageHeaderProps = {
  title: string;
  backHref: string;
  backDisabled?: boolean;
};

export function AccountPageHeader({ title, backHref, backDisabled }: AccountPageHeaderProps) {
  return (
    <div className="flex items-center gap-3">
      <AccountBackButton href={backHref} disabled={backDisabled} />
      <SecTitle as="h2" className="!mt-0">{title}</SecTitle>
    </div>
  );
}
