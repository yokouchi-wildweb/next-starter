// src/app/(user)/(auth)/login/page.tsx

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Flex } from "@/components/Layout/Flex";
import { UserLogin } from "@/features/core/auth/components/UserLogin";

type UserLoginPageProps = {
  searchParams?: Promise<{
    returnTo?: string;
  }>;
};

export default async function UserLoginPage({ searchParams }: UserLoginPageProps) {
  const returnTo = searchParams ? (await searchParams).returnTo : undefined;

  return (
    <UserPage containerType="narrowStack">
      <Flex direction="column" justify="center" align="center" gap="md">
        <UserPageTitle>ログイン</UserPageTitle>
        <UserLogin redirectTo={returnTo} />
      </Flex>
    </UserPage>
  );
}
