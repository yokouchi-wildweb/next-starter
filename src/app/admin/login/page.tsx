// src/app/admin/login/page.tsx

import { redirect } from "next/navigation";

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Main, PageTitle, Section } from "@/components/TextBlocks";
import { AdminLogin } from "@/features/auth/components/AdminLogin";
import { authGuard } from "@/features/auth/services/server/authorization";

export default async function AdminLoginPage() {
  const sessionUser = await authGuard({ allowRoles: ["admin"] });

  if (sessionUser) {
    redirect("/admin");
  }

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
