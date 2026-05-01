// src/features/core/purchaseRequest/components/BankTransferInstructionPage/TransferIdentifierCard.tsx
//
// 振込人名末尾に付与する識別子の表示ブロック。振込先口座モーダルの上部に配置する。
// 識別子は数字 8 桁。バックエンドの generateInhouseTransferIdentifier() で生成される。
// 識別子の付け忘れは管理者の照合不能を招くため、destructive (赤) 系で強調する。

import { AlertTriangle } from "lucide-react";

import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para, Span } from "@/components/TextBlocks";

import { CopyButton } from "./CopyButton";

// 振込人名は通常カタカナで届くため、例示もカタカナで揃える（姓名の間にスペース）
const EXAMPLE_NAME_KANA = "ヤマダ タロウ";
// identifier 未生成時のフォールバック表示用の数字
const EXAMPLE_FALLBACK_IDENTIFIER = "13495532";

type Props = {
  /** 振込人名末尾に付与する識別子（数字 8 桁） */
  identifier: string;
};

export function TransferIdentifierCard({ identifier }: Props) {
  const hasIdentifier = identifier.trim() !== "";
  const exampleIdentifier = hasIdentifier ? identifier : EXAMPLE_FALLBACK_IDENTIFIER;

  return (
    // モーダル内表示が前提のため padding は sm（外側パディングと二重に効くのを抑える）
    <Block padding="sm" className="rounded-lg border-2 border-destructive/40 bg-destructive/5">
      <Stack space={2}>
        <Flex gap="xs" align="center">
          <AlertTriangle aria-hidden className="h-4 w-4 shrink-0 text-destructive" />
          <Span weight="semiBold" size="md" tone="destructive">
            振込人名（末尾に数字を付与）
          </Span>
        </Flex>

        <Para size="xs" className="my-1 leading-snug">
          ご自身のお名前の末尾に、必ず以下の数字を付けてお振込みください。付け忘れると入金確認ができません。
        </Para>

        {/* 識別子を大きく等幅で表示 + コピー（ラベル / 数字 / ボタンを縦に中央揃え） */}
        <Block padding="sm" className="rounded-md border border-destructive/30 bg-card">
          <Stack space={2} className="items-center">
            <Span size="xs" tone="muted">
              振込人名末尾の数字
            </Span>
            <Span size="xxl" weight="bold" className="font-mono tracking-widest">
              {hasIdentifier ? identifier : "（未生成）"}
            </Span>
            {hasIdentifier && <CopyButton value={identifier} label="数字をコピー" />}
          </Stack>
        </Block>

        <Para size="xs" tone="muted">
          例: 「{EXAMPLE_NAME_KANA}」→{" "}
          <Span size="xs" weight="medium">
            「{EXAMPLE_NAME_KANA} {exampleIdentifier}」
          </Span>
        </Para>
      </Stack>
    </Block>
  );
}
