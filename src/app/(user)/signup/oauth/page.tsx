// src/app/(user)/signup/oauth/page.tsx

import { Main, PageTitle } from "@/components/TextBlocks";
import { USER_PROVIDER_TYPES } from "@/constants/user";
import { OAuth } from "@/features/auth/components/OAuth";
import type { UserProviderType } from "@/types/user";

type SignUpOAuthPageProps = {
  searchParams?: Promise<{
    provider?: string;
  }>;
};

export default async function SignUpOAuthPage({
  searchParams,
}: SignUpOAuthPageProps) {
  const providerParam = searchParams ? (await searchParams).provider : undefined;
  const provider: UserProviderType | undefined =
    providerParam && USER_PROVIDER_TYPES.includes(providerParam as UserProviderType)
      ? (providerParam as UserProviderType)
      : undefined;

  return (
    <Main variant="narrowStack">
      <PageTitle variant="srOnly">OAuth認証</PageTitle>
      <OAuth provider={provider} />
    </Main>
  );
}
