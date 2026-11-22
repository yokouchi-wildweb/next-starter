// src/domains/core/messaging/plugs/messagingLayouts/alert/AlertInApp.default.tsx
// レイアウト「セキュリティの警告」のお知らせ(受け取り箱の詳しい表示)の既定の見た目。props だけの部品(hook なし)。
// 件名は呼び手(受け取り箱の画面)が見出しに出すので、ここは説明・ラベルと値(表 = Grid)・心当たりの段落(最初の行を太字)

import { Grid } from "@/components/Layout/Grid";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import type { MessageLayoutSummary } from "@/lib/messaging";

import { splitFirstLine, visibleDetails, type AlertValues } from "./layout";

export type AlertInAppProps = {
  values: AlertValues;
  summary: MessageLayoutSummary;
};

function Notice({ text }: { text: string }) {
  const { first, rest } = splitFirstLine(text);
  return (
    <Stack gap="2xs">
      <Para weight="bold" className="break-words">
        {first}
      </Para>
      {rest !== null ? <Para className="whitespace-pre-wrap break-words">{rest}</Para> : null}
    </Stack>
  );
}

export function AlertInApp({ values }: AlertInAppProps) {
  const { explanation, notYou, ifYou } = values;
  const rows = visibleDetails(values);
  return (
    <Stack gap="sm" data-slot="alert-in-app">
      {explanation ? <Para className="whitespace-pre-wrap break-words">{explanation}</Para> : null}
      {rows.length > 0 ? (
        <Grid className="grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md bg-muted p-3" data-slot="alert-details">
          {rows.flatMap((row, index) => [
            <Para key={`k${index}`} size="sm" tone="muted">
              {row.key}
            </Para>,
            <Para key={`v${index}`} size="sm" className="break-words">
              {row.value}
            </Para>,
          ])}
        </Grid>
      ) : null}
      {notYou ? <Notice text={notYou} /> : null}
      {ifYou ? <Notice text={ifYou} /> : null}
    </Stack>
  );
}
