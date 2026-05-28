// src/app/admin/login/page.tsx

import { redirect } from "next/navigation";

import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { Main } from "@/components/TextBlocks";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import { AdminLogin } from "@/features/core/auth/components/AdminLogin";
import { authGuard } from "@/features/core/auth/services/server/authorization";
import { getRolesByCategory } from "@/features/core/user/constants";
import { resolveReturnTo } from "@/lib/crud/utils/paths";
import Link from "next/link";

const DEFAULT_REDIRECT_PATH = "/admin";

type AdminLoginPageProps = {
  searchParams?: Promise<{
    returnTo?: string;
  }>;
};

export default async function AdminLoginPage({ searchParams }: AdminLoginPageProps) {
  const rawReturnTo = searchParams ? (await searchParams).returnTo : undefined;
  // open redirect 対策として内部パスのみを許可する
  const redirectPath = resolveReturnTo(rawReturnTo, DEFAULT_REDIRECT_PATH);

  const sessionUser = await authGuard({ allowRoles: getRolesByCategory("admin") });

  if (sessionUser) {
    redirect(redirectPath);
  }

  return (
    <Main containerType="narrowStack">
      <Flex direction="column" justify="center" align="center" gap="xl">
        <Section as="header" className="w-full">
          <PageTitle marginBottom="xs">管理者ログイン</PageTitle>
        </Section>
        <AdminLogin redirectTo={redirectPath} />
        <Link href="/">サービストップへ戻る</Link>
      </Flex>
    </Main>
  );
}
