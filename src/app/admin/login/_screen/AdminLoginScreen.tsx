// src/app/admin/login/_screen/AdminLoginScreen.tsx
// /admin/login の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md
//
// ログイン後の遷移先とログイン済みの redirect は loader が担う。フォームはセクションコンテナ AdminLogin。

import { Link } from "@/components/Navigation";

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { Main } from "@/components/TextBlocks";
import AdminPage from "@/app/admin/_layout/AdminPage";
import PageTitle from "@/app/admin/_layout/PageTitle";
import { AdminLogin } from "@/features/core/auth/components/AdminLogin";
import type { ScreenProps } from "@/lib/screens/types";

import { loadAdminLoginScreen, type AdminLoginScreenSearchParams } from "./loader";

export async function AdminLoginScreen(props: ScreenProps<Record<string, never>, AdminLoginScreenSearchParams>) {
  const { redirectTo } = await loadAdminLoginScreen(props);

  // ヘッダーの行は AdminPage が描く(未ログインでもロゴと明暗の切り替えだけの同じ行)。この画面は自分のスクロール領域と Main を持つので main={false}
  return (
    <AdminPage main={false}>
      <Block className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
        {/* 管理の枠は固定高さ(AdminLayout の overflow-clip)で body が伸びないため、この画面は自分でスクロールする。
          狭い画面やソフトウェアキーボードで高さが縮んでもフォームの下まで届く */}
        <Main containerType="narrowStack">
          <Flex direction="column" justify="center" align="center" gap="xl">
            <Section as="header" className="w-full">
              <PageTitle placement="page" marginBottom="xs">
                管理者ログイン
              </PageTitle>
            </Section>
            <AdminLogin redirectTo={redirectTo} />
            <Link href="/">サービストップへ戻る</Link>
          </Flex>
        </Main>
      </Block>
    </AdminPage>
  );
}
