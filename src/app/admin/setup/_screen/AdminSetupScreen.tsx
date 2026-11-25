// src/app/admin/setup/_screen/AdminSetupScreen.tsx
// /admin/setup の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md

import { Block } from "@/components/Layout/Block";
import { Stack } from "@/components/Layout/Stack";
import { Section } from "@/components/Layout/Section";
import { Main } from "@/components/Layout/Main";
import { Para } from "@/components/TextBlocks/Para";
import AdminPage from "@/app/admin/_layout/AdminPage";
import { createScreen } from "@/wiring/screen";
import AdminSetupForm from "./AdminSetupForm";

import { loadAdminSetupScreen } from "./loader";

export const { Screen: AdminSetupScreen, generateMetadata } = createScreen({
  load: loadAdminSetupScreen,
  render: () => (
    <AdminPage main={false} title="管理コンソールへようこそ！">
      <Block className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        {/* 管理の枠は固定高さ(AdminLayout の overflow-clip)で body が伸びないため、この画面は自分でスクロールする。
          狭い画面やソフトウェアキーボードで高さが縮んでもフォームの下まで届く */}
        <Main containerType="narrowStack">
          <Section id="admin-setup">
            <Para>最初の管理ユーザーを登録し、管理設定を初期化します。</Para>
            <Stack marginBlock="lg" gap="none" padding="none">
              <AdminSetupForm />
            </Stack>
          </Section>
        </Main>
      </Block>
    </AdminPage>
  ),
});
