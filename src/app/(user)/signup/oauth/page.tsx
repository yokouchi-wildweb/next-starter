// src/app/(user)/signup/oauth/page.tsx

import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { PageTitle } from "@/components/TextBlocks";
import { USER_PROVIDER_TYPES } from "@/constants/user";
import { OAuth } from "@/features/core/auth/components/OAuth";
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
    <UserPage containerType="narrowStack">
      <PageTitle className="sr-only">OAuth認証</PageTitle>
      <OAuth provider={provider} />
    </UserPage>
  );
}
