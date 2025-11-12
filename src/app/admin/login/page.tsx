// src/app/admin/login/page.tsx

import { redirect } from "next/navigation";

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
    <Main variant="narrowStack">
      <Flex direction="column" justify="center" align="center" space="md">
        <Section as="header" className="w-full">
          <PageTitle>管理者ログイン</PageTitle>
        </Section>
        <AdminLogin />
      </Flex>
    </Main>
  );
}
