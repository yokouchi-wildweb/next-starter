// src/app/admin/login/page.tsx

import { redirect } from "next/navigation";

import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { Main } from "@/components/TextBlocks";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import { AdminLogin } from "@/features/auth/components/AdminLogin";
import { authGuard } from "@/features/auth/services/server/authorization";
import Link from "next/link";

export default async function AdminLoginPage() {
  const sessionUser = await authGuard({ allowRoles: ["admin"] });

  if (sessionUser) {
    redirect("/admin");
  }

  return (
    <Main containerType="narrowStack">
      <Flex direction="column" justify="center" align="center" space="xl">
        <Section as="header" className="w-full">
          <AdminPageTitle>管理者ログイン</AdminPageTitle>
        </Section>
        <AdminLogin />
        <Link href="/">サービストップへ戻る</Link>
      </Flex>
    </Main>
  );
}
