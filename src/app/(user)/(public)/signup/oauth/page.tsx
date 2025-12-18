// src/app/(user)/signup/oauth/page.tsx

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
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
      <UserPageTitle srOnly>OAuth認証</UserPageTitle>
      <OAuth provider={provider} />
    </UserPage>
  );
}
