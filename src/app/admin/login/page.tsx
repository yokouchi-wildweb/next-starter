// src/app/admin/login/page.tsx

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Main, PageTitle, Section } from "@/components/TextBlocks";
import { AdminLogin } from "@/features/auth/components/AdminLogin";

export default function AdminLoginPage() {
  return (
    <Main variant="contentShell">
      <Flex direction="column" minHeight="screen" justify="center" align="center">
        <Block className="w-full max-w-md" space="md">
          <Section as="header">
            <PageTitle>管理者ログイン</PageTitle>
          </Section>
          <AdminLogin />
        </Block>
      </Flex>
    </Main>
  );
}
