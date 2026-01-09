// src/app/(user)/(auth)/login/page.tsx

import { redirect } from "next/navigation";

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Flex } from "@/components/Layout/Flex";
import { UserLogin } from "@/features/core/auth/components/UserLogin";
import { authGuard } from "@/features/core/auth/services/server/authorization";

export default async function UserLoginPage() {

  return (
    <UserPage containerType="narrowStack">
      <Flex direction="column" justify="center" align="center" space="md">
        <UserPageTitle>ログイン</UserPageTitle>
        <UserLogin />
      </Flex>
    </UserPage>
  );
}
