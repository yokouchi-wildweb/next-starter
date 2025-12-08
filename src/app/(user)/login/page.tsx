// src/app/(user)/login/page.tsx

import { redirect } from "next/navigation";

import { UserPage } from "@/components/AppFrames/User/Layout/UserPage";
import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { PageTitle } from "@/components/TextBlocks";
import { UserLogin } from "@/features/core/auth/components/UserLogin";
import { authGuard } from "@/features/core/auth/services/server/authorization";

export default async function UserLoginPage() {

  return (
    <UserPage containerType="narrowStack">
      <Flex direction="column" justify="center" align="center" space="md">
        <Section as="header">
          <PageTitle>ログイン</PageTitle>
        </Section>
        <UserLogin />
      </Flex>
    </UserPage>
  );
}
