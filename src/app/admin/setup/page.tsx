// src/app/admin/setup/page.tsx

import { redirect } from "next/navigation";

import { Block } from "@/components/Layout/Block";
import { Section } from "@/components/Layout/Section";
import { Main, Para } from "@/components/TextBlocks";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";
import { authGuard } from "@/features/auth/services/server/authorization";
import AdminSetupForm from "@/features/setting/components/AdminSetup";

export default async function AdminSetupPage() {
  const sessionUser = await authGuard({ allowRoles: ["admin"] });

  if (sessionUser) {
    redirect("/admin");
  }

  return (
    <Main>
      <Section id="admin-setup">
        <AdminPageTitle>管理コンソールへようこそ！</AdminPageTitle>
        <Para>最初の管理ユーザーを登録し、管理設定を初期化します。</Para>
        <Block marginBlock="lg" space="none" padding="none">
          <AdminSetupForm />
        </Block>
      </Section>
    </Main>
  );
}
