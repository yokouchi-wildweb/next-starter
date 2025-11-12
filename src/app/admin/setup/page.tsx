// src/app/admin/setup/page.tsx

import { Section } from "@/components/Layout/Section";
import { Main, Para } from "@/components/TextBlocks";
import AdminPageTitle from "@/components/Admin/Layout/AdminPageTitle";

export default function AdminSetupPage() {
  return (
    <Main>
      <Section id="admin-setup">
        <AdminPageTitle>管理コンソールへようこそ！</AdminPageTitle>
        <Para>初回セットアップを開始します。</Para>
      </Section>
    </Main>
  );
}
