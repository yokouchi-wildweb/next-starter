// src/components/AppFrames/User/Elements/PageTitle.tsx

import { Section } from "@/components/Layout/Section";
import { PageTitle as BasePageTitle, type PageTitleProps } from "@/components/TextBlocks";

export type UserPageTitleProps = PageTitleProps;

export function UserPageTitle({ children, srOnly, ...props }: UserPageTitleProps) {
  // srOnly時はSectionをレンダリングせず、h1のみを返す
  // これにより、親のgap-*による余白が発生しなくなる
  if (srOnly) {
    return (
      <BasePageTitle srOnly {...props}>{children}</BasePageTitle>
    );
  }

  return (
    <Section as="header" id="page-title" className="py-4">
      <BasePageTitle align="center" {...props}>{children}</BasePageTitle>
    </Section>
  );
}
