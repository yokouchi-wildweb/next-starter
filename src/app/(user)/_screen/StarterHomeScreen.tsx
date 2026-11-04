// src/app/(user)/_screen/StarterHomeScreen.tsx
// トップページ(/)の既定画面(page 層の本体)。上流 next-starter のデモ用トップ。Server Component。
// 上流所有。下流は編集・削除せず、自前のトップページを ../_components/<Name>Screen.tsx に作って
// ../page.tsx の import 先を差し替える(README.md 参照)。部品は ./StarterHome/ にある(Screen 専用、契約外)。
//
// レイアウト: fill(../frame.ts の page の fill: true)でヘッダー下〜フッター上の残り高さちょうどに収め、
// ページ自体はスクロールしない(本文は flex-1 min-h-0 で残り高さを占める)。内容が収まらない小さな画面では内側だけがスクロールする。
// 背景は FullScreen layer="background" でビューポート全体に敷く(コンテナ幅に閉じない)。

import type { ScreenProps } from "@/lib/screens/types";
import { Link } from "@/components/Navigation";

import { UserPage } from "@/app/(user)/_layout/UserPage";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import FullScreen from "@/components/Layout/FullScreen";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { Span } from "@/components/TextBlocks";
import { gate } from "@/featureGate";

import { Backdrop } from "./StarterHome/Backdrop";
import { Capabilities } from "./StarterHome/Capabilities";
import { Hero } from "./StarterHome/Hero";

import { loadStarterHomeScreen } from "./loader";

const RESOURCE_LINKS = [
  { href: "https://nextjs.org/docs", label: "Next.js Docs" },
  { href: "https://wildweb.tokyo", label: "Wildweb Tokyo" },
] as const;

export async function StarterHomeScreen(props: ScreenProps) {
  await loadStarterHomeScreen(props);

  const demoEnabled = gate.enabled("demoPages");

  return (
    <>
      <FullScreen layer="background" disableScroll={false}>
        <Backdrop />
      </FullScreen>

      <UserPage
        containerType="plain"
        padding="md"
        className="flex min-h-0 flex-1 flex-col overflow-clip overscroll-none relative content-layer"
      >
        {/* 縦中央寄せは justify-center ではなく my-auto で行う（溢れた時に上端が切れないため） */}
        <Flex direction="column" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <Block className="mx-auto my-auto w-full max-w-[var(--layout-width-content-shell)] py-6">
            <Stack space={10} className="sm:gap-12">
              <Hero showDemoLink={demoEnabled} />
              <Capabilities />

              <Section as="footer">
                <Flex justify="center" gap="md" wrap="wrap">
                  {RESOURCE_LINKS.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                    >
                      <Span size="xs">{link.label}</Span>
                    </Link>
                  ))}
                </Flex>
              </Section>
            </Stack>
          </Block>
        </Flex>
      </UserPage>
    </>
  );
}
