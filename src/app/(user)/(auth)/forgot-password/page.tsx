// src/app/(user)/(auth)/forgot-password/page.tsx

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Flex } from "@/components/Layout/Flex";
import { ForgotPassword } from "@/features/core/auth/components/ForgotPassword";

export default function ForgotPasswordPage() {
  return (
    <UserPage containerType="narrowStack">
      <Flex direction="column" justify="center" align="center" gap="md">
        <UserPageTitle>パスワードをリセット</UserPageTitle>
        <ForgotPassword />
      </Flex>
    </UserPage>
  );
}
