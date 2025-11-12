// src/app/admin/setup/page.tsx

import { Section } from "@/components/Layout/Section";
import { Main, PageTitle, Para } from "@/components/TextBlocks";

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
