// src/app/(user)/(auth)/password/reset/page.tsx

import { UserPageTitle } from "@/components/AppFrames/User/Elements/PageTitle";
import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Flex } from "@/components/Layout/Flex";
import { ResetPassword } from "@/features/core/auth/components/ResetPassword";

type ResetPasswordPageProps = {
  searchParams?: Promise<{
    oobCode?: string;
  }>;
};

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const oobCode = searchParams ? (await searchParams).oobCode ?? null : null;

  return (
    <UserPage containerType="narrowStack">
      <Flex direction="column" justify="center" align="center" gap="md">
        <UserPageTitle>パスワードを再設定</UserPageTitle>
        <ResetPassword oobCode={oobCode} />
      </Flex>
    </UserPage>
  );
}
