// src/components/AppFrames/User/Elements/PageTitle.tsx

import { Section } from "@/components/Layout/Section";
import { PageTitle as BasePageTitle, type PageTitleProps } from "@/components/TextBlocks";

export type UserPageTitleProps = PageTitleProps;

export function UserPageTitle({ children, ...props }: UserPageTitleProps) {
  return (
    <Section as="header" id="page-title">
      <BasePageTitle {...props}>{children}</BasePageTitle>
    </Section>
  );
}
