// src/app/(user)/signup/register/page.tsx

import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Section } from "@/components/Layout/Section";
import { PageTitle } from "@/components/TextBlocks";
import { Registration } from "@/features/core/auth/components/Registration";

type SignUpRegisterPageProps = {
  searchParams?: Promise<{
    method?: string;
  }>;
};

export default async function SignUpRegisterPage({
  searchParams,
}: SignUpRegisterPageProps) {
  const methodParam = searchParams ? (await searchParams).method : undefined;
  const method =
    methodParam === "thirdParty"
      ? "thirdParty"
      : methodParam === "email"
        ? "email"
        : undefined;

  return (
    <UserPage containerType="narrowStack">
      <Section as="header">
        <PageTitle>本登録</PageTitle>
      </Section>
      <Registration method={method} />
    </UserPage>
  );
}
