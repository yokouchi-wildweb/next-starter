// src/app/admin/setup/page.tsx

import { Main, PageTitle, Para, Section } from "@/components/TextBlocks";

export default function AdminSetupPage() {
  return (
    <Main>
      <Section id="admin-setup">
        <PageTitle>管理コンソールへようこそ！</PageTitle>
        <Para>初回セットアップを開始します。</Para>
      </Section>
    </Main>
  );
}
