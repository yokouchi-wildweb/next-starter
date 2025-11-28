// src/app/admin/setup/page.tsx

import { redirect } from "next/navigation";

import { Block } from "@/components/Layout/Block";
import { Section } from "@/components/Layout/Section";
import { Main, Para } from "@/components/TextBlocks";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import AdminSetupForm from "@/features/core/setting/components/AdminSetup";
import { checkAdminUserExists } from "@/features/core/user/services/server/checkAdminUserExists";

export default async function AdminSetupPage() {
  const hasAdmin = await checkAdminUserExists();

  if (hasAdmin) {
    redirect("/admin/login");
  }

  return (
    <Main containerType="narrowStack">
      <Section id="admin-setup">
        <PageTitle>管理コンソールへようこそ！</PageTitle>
        <Para>最初の管理ユーザーを登録し、管理設定を初期化します。</Para>
        <Block marginBlock="lg" space="none" padding="none">
          <AdminSetupForm />
        </Block>
      </Section>
    </Main>
  );
}
