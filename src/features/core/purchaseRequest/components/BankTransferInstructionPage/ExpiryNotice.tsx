// src/features/core/purchaseRequest/components/BankTransferInstructionPage/ExpiryNotice.tsx
//
// お振込み期限の控えめな表示（中央揃え・小サイズ・muted トーン）。

import { Clock } from "lucide-react";

import { Flex } from "@/components/Layout/Flex";
import { Span } from "@/components/TextBlocks";

type Props = {
  expiresAt: Date;
};

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

function formatExpiry(date: Date): string {
  // M/D (曜) HH:MM 形式（年は跨がない想定）
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const w = WEEKDAYS[date.getDay()];
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${m}/${d} (${w}) ${hh}:${mm}`;
}

export function ExpiryNotice({ expiresAt }: Props) {
  return (
    <Flex justify="center" align="center" gap="xs">
      <Clock aria-hidden className="h-3.5 w-3.5 text-muted-foreground" />
      <Span size="xs" tone="muted">
        お振込み期限: {formatExpiry(expiresAt)}
      </Span>
    </Flex>
  );
}
