// src/app/admin/login/_screen/AdminLoginScreen.tsx
// /admin/login の既定画面(page 層の本体)。上流所有。下流は編集・削除せず、
// 差し替えるときは同じルートの _components/ に自分の Screen を作り page.tsx を向ける(loader の import は ../_screen/loader に直す)。
// 手順: src/lib/screens/README.md
//
// ログイン後の遷移先とログイン済みの redirect は loader が担う。フォームはセクションコンテナ AdminLogin。

import Link from "next/link";

import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { Main } from "@/components/TextBlocks";
import PageTitle from "@/components/AppFrames/Admin/Elements/PageTitle";
import { AdminLogin } from "@/features/core/auth/components/AdminLogin";
import type { ScreenProps } from "@/lib/screens/types";

import { loadAdminLoginScreen, type AdminLoginScreenSearchParams } from "./loader";

export async function AdminLoginScreen(props: ScreenProps<Record<string, never>, AdminLoginScreenSearchParams>) {
  const { redirectTo } = await loadAdminLoginScreen(props);

  return (
    <Main containerType="narrowStack">
      <Flex direction="column" justify="center" align="center" gap="xl">
        <Section as="header" className="w-full">
          <PageTitle marginBottom="xs">管理者ログイン</PageTitle>
        </Section>
        <AdminLogin redirectTo={redirectTo} />
        <Link href="/">サービストップへ戻る</Link>
      </Flex>
    </Main>
  );
}
