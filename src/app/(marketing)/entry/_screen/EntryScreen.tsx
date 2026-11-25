// src/app/(marketing)/entry/_screen/EntryScreen.tsx
// /entry(事前登録専用ページ)の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける
// (部品の import は ../_screen/CampaignSection 等に直すか、自分の部品に置き換える)。手順: src/lib/screens/README.md
//
// loader は access の評価だけ(public)。CampaignSection は fork がキャンペーン情報に置き換える前提のプレースホルダー。

import { Main } from "@/components/Layout/Main";
import { PageTitle } from "@/components/TextBlocks/PageTitle";
import { createScreen } from "@/wiring/screen";

import { CampaignSection } from "./CampaignSection";
import { EntrySignupSection } from "./EntrySignupSection";

import { loadEntryScreen } from "./loader";

export const { Screen: EntryScreen, generateMetadata } = createScreen({
  load: loadEntryScreen,
  render: () => (
    <Main containerType="contentShell" padding={{ base: "sm", sm: "md" }}>
      <PageTitle srOnly>事前登録</PageTitle>
      <CampaignSection />
      <EntrySignupSection />
    </Main>
  ),
});
