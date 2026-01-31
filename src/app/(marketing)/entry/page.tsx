// src/app/(marketing)/entry/page.tsx
// 事前登録専用ページ

import { Main } from "@/components/Layout/Main";
import { PageTitle } from "@/components/TextBlocks";

import { CampaignSection } from "./_components/CampaignSection";
import { EntrySignupSection } from "./_components/EntrySignupSection";

export default async function EntryPage() {
  return (
    <Main containerType="contentShell" padding="md">
      <PageTitle srOnly>事前登録</PageTitle>
      <CampaignSection />
      <EntrySignupSection />
    </Main>
  );
}
