// src/app/admin/setup/_screen/AdminSetupScreen.tsx
// /admin/setup の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import type { ScreenProps } from "@/lib/screens/types";
import { Stack } from "@/components/Layout/Stack";
import { Section } from "@/components/Layout/Section";
import { Main, Para } from "@/components/TextBlocks";
import PageTitle from "@/app/admin/_layout/PageTitle";
import AdminSetupForm from "./AdminSetupForm";

import { loadAdminSetupScreen } from "./loader";

export async function AdminSetupScreen(props: ScreenProps) {
  await loadAdminSetupScreen(props);

  return (
    <Main containerType="narrowStack">
      <Section id="admin-setup">
        <PageTitle placement="page">管理コンソールへようこそ！</PageTitle>
        <Para>最初の管理ユーザーを登録し、管理設定を初期化します。</Para>
        <Stack marginBlock="lg" space={0} padding="none">
          <AdminSetupForm />
        </Stack>
      </Section>
    </Main>
  );
}
