// src/app/(user)/demo/status-badge/page.tsx

import { Check, X, AlertTriangle, Clock, Star } from "lucide-react";

import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { PageTitle, Para, SecTitle } from "@/components/TextBlocks";
import { SoftBadge, SolidBadge } from "@/components/Badge";

export default function BadgeDemoPage() {
  return (
    <div className="px-6 py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
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
          <Stack space={2}>
            <SecTitle as="h2">SoftBadge</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              薄い背景 + ボーダー + 色付きテキスト。柔らかい印象。
            </Para>
          </Stack>

          <div className="flex flex-wrap gap-3">
            <SoftBadge variant="primary">primary</SoftBadge>
            <SoftBadge variant="secondary">secondary</SoftBadge>
            <SoftBadge variant="destructive">destructive</SoftBadge>
            <SoftBadge variant="success">success</SoftBadge>
            <SoftBadge variant="accent">accent</SoftBadge>
            <SoftBadge variant="muted">muted</SoftBadge>
            <SoftBadge variant="outline">outline</SoftBadge>
            <SoftBadge variant="ghost">ghost</SoftBadge>
          </div>
        </Section>

        {/* SolidBadge */}
        <Section className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm">
          <Stack space={2}>
            <SecTitle as="h2">SolidBadge</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              不透明背景 + foregroundテキスト。ソリッドな印象。
            </Para>
          </Stack>

          <div className="flex flex-wrap gap-3">
            <SolidBadge variant="primary">primary</SolidBadge>
            <SolidBadge variant="secondary">secondary</SolidBadge>
            <SolidBadge variant="destructive">destructive</SolidBadge>
            <SolidBadge variant="success">success</SolidBadge>
            <SolidBadge variant="accent">accent</SolidBadge>
            <SolidBadge variant="muted">muted</SolidBadge>
          </div>
        </Section>

        {/* サイズ */}
        <Section className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm">
          <Stack space={2}>
            <SecTitle as="h2">サイズ</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              sm / md / lg の3サイズ。
            </Para>
          </Stack>

          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="w-16 text-sm text-muted-foreground">Soft:</span>
              <SoftBadge variant="success" size="sm">sm</SoftBadge>
              <SoftBadge variant="success" size="md">md</SoftBadge>
              <SoftBadge variant="success" size="lg">lg</SoftBadge>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="w-16 text-sm text-muted-foreground">Solid:</span>
              <SolidBadge variant="success" size="sm">sm</SolidBadge>
              <SolidBadge variant="success" size="md">md</SolidBadge>
              <SolidBadge variant="success" size="lg">lg</SolidBadge>
            </div>
          </div>
        </Section>

        {/* アイコン付き */}
        <Section className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm">
          <Stack space={2}>
            <SecTitle as="h2">アイコン付き</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              icon プロパティでアイコンを渡せます。
            </Para>
          </Stack>

          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-3">
              <SoftBadge variant="success" icon={Check}>完了</SoftBadge>
              <SoftBadge variant="destructive" icon={X}>エラー</SoftBadge>
              <SoftBadge variant="accent" icon={AlertTriangle}>警告</SoftBadge>
              <SoftBadge variant="secondary" icon={Clock}>処理中</SoftBadge>
              <SoftBadge variant="muted" icon={Star}>下書き</SoftBadge>
            </div>
            <div className="flex flex-wrap gap-3">
              <SolidBadge variant="success" icon={Check}>完了</SolidBadge>
              <SolidBadge variant="destructive" icon={X}>エラー</SolidBadge>
              <SolidBadge variant="accent" icon={AlertTriangle}>警告</SolidBadge>
              <SolidBadge variant="secondary" icon={Clock}>処理中</SolidBadge>
              <SolidBadge variant="muted" icon={Star}>下書き</SolidBadge>
            </div>
          </div>
        </Section>

        {/* 実用例 */}
        <Section className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm">
          <Stack space={2}>
            <SecTitle as="h2">実用例</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              管理画面でのステータス表示例。
            </Para>
          </Stack>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded border p-3">
              <span>注文 #001</span>
              <SoftBadge variant="success">発送済み</SoftBadge>
            </div>
            <div className="flex items-center justify-between rounded border p-3">
              <span>注文 #002</span>
              <SolidBadge variant="secondary">処理中</SolidBadge>
            </div>
            <div className="flex items-center justify-between rounded border p-3">
              <span>注文 #003</span>
              <SoftBadge variant="muted">キャンセル</SoftBadge>
            </div>
            <div className="flex items-center justify-between rounded border p-3">
              <span>注文 #004</span>
              <SolidBadge variant="destructive">支払いエラー</SolidBadge>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
