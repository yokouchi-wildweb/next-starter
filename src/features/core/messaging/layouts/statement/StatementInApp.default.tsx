// src/features/core/messaging/layouts/statement/StatementInApp.default.tsx
// レイアウト「明細」のお知らせ(受け取り箱の詳しい表示)の既定の見た目。props だけの部品(hook なし)。
// 件名は呼び手(受け取り箱の画面)が見出しに出すので、ここは宛名と本文(改行はそのまま)

import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import type { MessageLayoutSummary } from "@/lib/messaging";

import type { StatementValues } from "./layout";

export type StatementInAppProps = {
  values: StatementValues;
  summary: MessageLayoutSummary;
};

export function StatementInApp({ values }: StatementInAppProps) {
  const { addressee, body } = values;
  return (
    <Stack gap="sm" data-slot="statement-in-app">
      {addressee ? <Para size="sm">{addressee}</Para> : null}
      {body ? <Para className="whitespace-pre-wrap break-words">{body}</Para> : null}
    </Stack>
  );
}
