// src/app/(user)/demo/status-badge/page.tsx

import { Check, X, AlertTriangle, Clock, Star } from "lucide-react";

import { Section } from "@/components/Layout/Section";
import { Stack } from "@/components/Layout/Stack";
import { PageTitle, Para, SecTitle } from "@/components/TextBlocks";
import { StatusBadge } from "@/components/Badge";

export default function StatusBadgeDemoPage() {
  return (
    <div className="px-6 py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        {/* ヘッダー */}
        <Section as="header" className="my-0 flex flex-col gap-2">
          <PageTitle size="xxxl" className="font-semibold tracking-tight">
            StatusBadge デモ
          </PageTitle>
          <Para tone="muted" size="sm" className="mt-0">
            ステータス表示用バッジコンポーネントの動作確認ページです。
          </Para>
        </Section>

        {/* バリアント一覧 */}
        <Section className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm">
          <Stack space={2}>
            <SecTitle as="h2">バリアント</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              用途に応じた8種類のバリアント。
            </Para>
          </Stack>

          <div className="flex flex-wrap gap-3">
            <StatusBadge variant="primary">primary</StatusBadge>
            <StatusBadge variant="secondary">secondary</StatusBadge>
            <StatusBadge variant="destructive">destructive</StatusBadge>
            <StatusBadge variant="success">success</StatusBadge>
            <StatusBadge variant="accent">accent</StatusBadge>
            <StatusBadge variant="muted">muted</StatusBadge>
            <StatusBadge variant="outline">outline</StatusBadge>
            <StatusBadge variant="ghost">ghost</StatusBadge>
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

          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge variant="success" size="sm">sm</StatusBadge>
            <StatusBadge variant="success" size="md">md</StatusBadge>
            <StatusBadge variant="success" size="lg">lg</StatusBadge>
          </div>
        </Section>

        {/* アイコン付き */}
        <Section className="my-0 flex flex-col gap-5 rounded-lg border bg-background p-6 shadow-sm">
          <Stack space={2}>
            <SecTitle as="h2">アイコン付き</SecTitle>
            <Para tone="muted" size="sm" className="mt-0">
              アイコンと組み合わせた使用例。
            </Para>
          </Stack>

          <div className="flex flex-wrap gap-3">
            <StatusBadge variant="success" icon={Check}>完了</StatusBadge>
            <StatusBadge variant="destructive" icon={X}>エラー</StatusBadge>
            <StatusBadge variant="accent" icon={AlertTriangle}>警告</StatusBadge>
            <StatusBadge variant="secondary" icon={Clock}>処理中</StatusBadge>
            <StatusBadge variant="muted" icon={Star}>下書き</StatusBadge>
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
              <StatusBadge variant="success">発送済み</StatusBadge>
            </div>
            <div className="flex items-center justify-between rounded border p-3">
              <span>注文 #002</span>
              <StatusBadge variant="secondary">処理中</StatusBadge>
            </div>
            <div className="flex items-center justify-between rounded border p-3">
              <span>注文 #003</span>
              <StatusBadge variant="muted">キャンセル</StatusBadge>
            </div>
            <div className="flex items-center justify-between rounded border p-3">
              <span>注文 #004</span>
              <StatusBadge variant="destructive">支払いエラー</StatusBadge>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}
