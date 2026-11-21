// src/app/(user)/demo/status-badge/_screen/DemoStatusBadgeScreen.tsx
// /demo/status-badge(デモ)の既定画面。

import type { ScreenProps } from "@/lib/screens";
import { Check, X, AlertTriangle, Clock, Star, Info, AlertCircle } from "lucide-react";

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { PageTitle } from "@/components/TextBlocks/PageTitle";
import { Para } from "@/components/TextBlocks/Para";
import { SecTitle } from "@/components/TextBlocks/SecTitle";
import { Span } from "@/components/TextBlocks/Span";
import { SoftBadge } from "@/components/Badge/SoftBadge";
import { SolidBadge } from "@/components/Badge/SolidBadge";

import { loadDemoStatusBadgeScreen } from "./loader";

export async function DemoStatusBadgeScreen(props: ScreenProps) {
  await loadDemoStatusBadgeScreen(props);

  return (
    <Block className="px-6 py-10">
      <Flex direction="column" gap="xl" className="mx-auto w-full max-w-3xl">
        {/* ヘッダー */}
        <Section as="header" className="my-0 flex flex-col gap-2">
          <PageTitle size="xxxl" className="font-semibold tracking-tight">
            Badge デモ
          </PageTitle>
          <Para tone="muted" size="sm" className="mt-0">
            SoftBadge / SolidBadge コンポーネントの動作確認ページです。
          </Para>
        </Section>

        {/* SoftBadge */}
        <Section className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm">
          <Stack gap="xs">
            <SecTitle as="h2">SoftBadge</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              薄い背景 + ボーダー + 色付きテキスト。柔らかい印象。
            </Para>
          </Stack>

          <Flex wrap="wrap" gap="sm">
            <SoftBadge variant="primary">primary</SoftBadge>
            <SoftBadge variant="secondary">secondary</SoftBadge>
            <SoftBadge variant="destructive">destructive</SoftBadge>
            <SoftBadge variant="success">success</SoftBadge>
            <SoftBadge variant="info">info</SoftBadge>
            <SoftBadge variant="warning">warning</SoftBadge>
            <SoftBadge variant="accent">accent</SoftBadge>
            <SoftBadge variant="muted">muted</SoftBadge>
            <SoftBadge variant="outline">outline</SoftBadge>
            <SoftBadge variant="ghost">ghost</SoftBadge>
          </Flex>
        </Section>

        {/* SolidBadge */}
        <Section className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm">
          <Stack gap="xs">
            <SecTitle as="h2">SolidBadge</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              不透明背景 + foregroundテキスト。ソリッドな印象。
            </Para>
          </Stack>

          <Flex wrap="wrap" gap="sm">
            <SolidBadge variant="primary">primary</SolidBadge>
            <SolidBadge variant="secondary">secondary</SolidBadge>
            <SolidBadge variant="destructive">destructive</SolidBadge>
            <SolidBadge variant="success">success</SolidBadge>
            <SolidBadge variant="info">info</SolidBadge>
            <SolidBadge variant="warning">warning</SolidBadge>
            <SolidBadge variant="accent">accent</SolidBadge>
            <SolidBadge variant="muted">muted</SolidBadge>
          </Flex>
        </Section>

        {/* サイズ */}
        <Section className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm">
          <Stack gap="xs">
            <SecTitle as="h2">サイズ</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              sm / md / lg の3サイズ。
            </Para>
          </Stack>

          <Flex direction="column" gap="md">
            <Flex wrap="wrap" align="center" gap="sm">
              <Span size="sm" weight="inherit" tone="muted" className="w-16">Soft:</Span>
              <SoftBadge variant="success" size="sm">sm</SoftBadge>
              <SoftBadge variant="success" size="md">md</SoftBadge>
              <SoftBadge variant="success" size="lg">lg</SoftBadge>
            </Flex>
            <Flex wrap="wrap" align="center" gap="sm">
              <Span size="sm" weight="inherit" tone="muted" className="w-16">Solid:</Span>
              <SolidBadge variant="success" size="sm">sm</SolidBadge>
              <SolidBadge variant="success" size="md">md</SolidBadge>
              <SolidBadge variant="success" size="lg">lg</SolidBadge>
            </Flex>
          </Flex>
        </Section>

        {/* アイコン付き */}
        <Section className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm">
          <Stack gap="xs">
            <SecTitle as="h2">アイコン付き</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              icon プロパティでアイコンを渡せます。
            </Para>
          </Stack>

          <Flex direction="column" gap="md">
            <Flex wrap="wrap" gap="sm">
              <SoftBadge variant="success" icon={Check}>完了</SoftBadge>
              <SoftBadge variant="destructive" icon={X}>エラー</SoftBadge>
              <SoftBadge variant="info" icon={Info}>お知らせ</SoftBadge>
              <SoftBadge variant="warning" icon={AlertCircle}>注意</SoftBadge>
              <SoftBadge variant="accent" icon={AlertTriangle}>警告</SoftBadge>
              <SoftBadge variant="secondary" icon={Clock}>処理中</SoftBadge>
              <SoftBadge variant="muted" icon={Star}>下書き</SoftBadge>
            </Flex>
            <Flex wrap="wrap" gap="sm">
              <SolidBadge variant="success" icon={Check}>完了</SolidBadge>
              <SolidBadge variant="destructive" icon={X}>エラー</SolidBadge>
              <SolidBadge variant="info" icon={Info}>お知らせ</SolidBadge>
              <SolidBadge variant="warning" icon={AlertCircle}>注意</SolidBadge>
              <SolidBadge variant="accent" icon={AlertTriangle}>警告</SolidBadge>
              <SolidBadge variant="secondary" icon={Clock}>処理中</SolidBadge>
              <SolidBadge variant="muted" icon={Star}>下書き</SolidBadge>
            </Flex>
          </Flex>
        </Section>

        {/* 実用例 */}
        <Section className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm">
          <Stack gap="xs">
            <SecTitle as="h2">実用例</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              管理画面でのステータス表示例。
            </Para>
          </Stack>

          <Flex direction="column" gap="md">
            <Flex align="center" justify="between" className="rounded border p-3">
              <Span inline>注文 #001</Span>
              <SoftBadge variant="success">発送済み</SoftBadge>
            </Flex>
            <Flex align="center" justify="between" className="rounded border p-3">
              <Span inline>注文 #002</Span>
              <SolidBadge variant="secondary">処理中</SolidBadge>
            </Flex>
            <Flex align="center" justify="between" className="rounded border p-3">
              <Span inline>注文 #003</Span>
              <SoftBadge variant="muted">キャンセル</SoftBadge>
            </Flex>
            <Flex align="center" justify="between" className="rounded border p-3">
              <Span inline>注文 #004</Span>
              <SolidBadge variant="destructive">支払いエラー</SolidBadge>
            </Flex>
          </Flex>
        </Section>
      </Flex>
    </Block>
  );
}
