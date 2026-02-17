// src/app/admin/login/page.tsx

import { redirect } from "next/navigation";

import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { Main } from "@/components/TextBlocks";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import { AdminLogin } from "@/features/core/auth/components/AdminLogin";
import { authGuard } from "@/features/core/auth/services/server/authorization";
import { getRolesByCategory } from "@/features/core/user/constants";
import Link from "next/link";

export default async function AdminLoginPage() {
  const sessionUser = await authGuard({ allowRoles: getRolesByCategory("admin") });

  if (sessionUser) {
    redirect("/admin");
  }

  return (
    <Main containerType="narrowStack">
      <Flex direction="column" justify="center" align="center" gap="xl">
        <Section as="header" className="w-full">
          <PageTitle marginBottom="xs">管理者ログイン</PageTitle>
        </Section>
        <AdminLogin />
        <Link href="/">サービストップへ戻る</Link>
      </Flex>
    </Main>
  );
}
