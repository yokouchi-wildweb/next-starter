// src/app/(user)/signup/register/page.tsx

import { Section } from "@/components/Layout/Section";
import { Main, PageTitle } from "@/components/TextBlocks";
import { Registration } from "@/features/auth/components/Registration";

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
    <Main containerType="narrowStack">
      <Section as="header">
        <PageTitle>本登録</PageTitle>
      </Section>
      <Registration method={method} />
    </Main>
  );
}
