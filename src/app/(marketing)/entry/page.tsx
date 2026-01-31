// src/app/(marketing)/entry/page.tsx
// 事前登録専用ページ

import { redirect } from "next/navigation";

import { APP_FEATURES } from "@/config/app/app-features.config";
import { Main } from "@/components/Layout/Main";
import { PageTitle } from "@/components/TextBlocks";

import { CampaignSection } from "./_components/CampaignSection";
import { EntrySignupSection } from "./_components/EntrySignupSection";

export default async function EntryPage() {
  // 通常登録モードの場合は通常のサインアップページへリダイレクト
  if (APP_FEATURES.auth.signup.mode === "normal") {
    redirect("/signup");
  }

  return (
    <Main containerType="contentShell" padding="md">
      <PageTitle srOnly>事前登録</PageTitle>
      <CampaignSection />
      <EntrySignupSection />
    </Main>
  );
}
