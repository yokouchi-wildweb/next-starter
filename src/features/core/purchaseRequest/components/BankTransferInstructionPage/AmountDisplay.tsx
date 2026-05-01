// src/features/core/purchaseRequest/components/BankTransferInstructionPage/AmountDisplay.tsx
//
// 振込金額の表示ブロック。中央揃え + 大きめサイズで視覚的に最重要情報として配置する。

import { Block } from "@/components/Layout/Block";
import { Stack } from "@/components/Layout/Stack";
import { Para, Span } from "@/components/TextBlocks";

type Props = {
  /** 振込金額（円） */
  amount: number;
};

export function AmountDisplay({ amount }: Props) {
  return (
    <Block padding="sm" className="rounded-lg border border-border bg-card">
      <Stack space={1} className="items-center">
        <Para size="sm" tone="muted">
          お振込み金額
        </Para>
        <Span size="xxxl" weight="bold" tone="primary">
          ¥{amount.toLocaleString()}
        </Span>
      </Stack>
    </Block>
  );
}
