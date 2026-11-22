// src/domains/core/user/components/common/AccountPageHeader.tsx

import { SecTitle } from "@/components/TextBlocks/SecTitle";
import { Flex } from "@/components/Layout/Flex";

import { AccountBackButton } from "./AccountBackButton";

type AccountPageHeaderProps = {
  title: string;
  backHref: string;
  backDisabled?: boolean;
};

export function AccountPageHeader({ title, backHref, backDisabled }: AccountPageHeaderProps) {
  return (
    <Flex align="center" className="gap-3">
      <AccountBackButton href={backHref} disabled={backDisabled} />
      <SecTitle as="h2" className="!mt-0">{title}</SecTitle>
    </Flex>
  );
}
