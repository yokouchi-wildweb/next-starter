// src/app/(user)/_layout/PageTitle.tsx

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

  // 外側の header に印 user-page-title(srOnly の時は外側が無いので付かない。中の h1 は page-title)
  return (
    <Section as="header" data-slot="user-page-title" className="py-4">
      <BasePageTitle align="center" {...props}>{children}</BasePageTitle>
    </Section>
  );
}
