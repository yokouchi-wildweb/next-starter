// src/app/(user)/(auth)/login/page.tsx

import { redirect } from "next/navigation";

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Flex } from "@/components/Layout/Flex";
import { UserLogin } from "@/features/core/auth/components/UserLogin";
import { authGuard } from "@/features/core/auth/services/server/authorization";

type UserLoginPageProps = {
  searchParams?: Promise<{
    returnTo?: string;
  }>;
};

export default async function UserLoginPage({ searchParams }: UserLoginPageProps) {
  const returnTo = searchParams ? (await searchParams).returnTo : undefined;

  // すでにログイン済みの場合はリダイレクト
  const session = await authGuard();
  if (session) {
    redirect(returnTo || "/");
  }

  return (
    <UserPage containerType="narrowStack">
      <Flex direction="column" justify="center" align="center" gap="md">
        <UserPageTitle>ログイン</UserPageTitle>
        <UserLogin redirectTo={returnTo} />
      </Flex>
    </UserPage>
  );
}
