// src/app/(user)/(auth)/signup/oauth/page.tsx

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { USER_PROVIDER_TYPES } from "@/features/core/user/constants";
import { OAuth } from "@/features/core/auth/components/OAuth";
import type { UserProviderType } from "@/features/core/user/types";

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
    <UserPage containerType="narrowStack" className="text-center items-center">
      <UserPageTitle srOnly>OAuth認証</UserPageTitle>
      <OAuth provider={provider} />
    </UserPage>
  );
}
