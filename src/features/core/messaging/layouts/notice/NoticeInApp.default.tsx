// src/features/core/messaging/layouts/notice/NoticeInApp.default.tsx
// レイアウト「汎用」のお知らせ(受け取り箱の詳しい表示)の既定の見た目。props だけの部品(hook なし)。
// ブロックを 1 種類ずつ components の部品で描く(生の HTML は使わない。区切り = 線の Block、表 = Grid、箇条書き = Stack)。
// 件名は呼び手(受け取り箱の画面)が見出しに出すので、ここは本文のブロックだけ

import { LinkButton } from "@/components/Button/LinkButton";
import { Block } from "@/components/Layout/Block";
import { Flex } from "@/components/Layout/Flex";
import { Grid } from "@/components/Layout/Grid";
import { Stack } from "@/components/Layout/Stack";
import { AppImage } from "@/components/Media/AppImage";
import { Para } from "@/components/TextBlocks/Para";
import { SecTitle } from "@/components/TextBlocks/SecTitle";
import type { MessageBlock, MessageLayoutSummary, MessageLayoutValues } from "@/lib/messaging";

export type NoticeInAppProps = {
  values: MessageLayoutValues;
  summary: MessageLayoutSummary;
};

function NoticeBlock({ block }: { block: MessageBlock }) {
  switch (block.type) {
    case "heading":
      return (
        <SecTitle as="h3" size="md">
          {block.text}
        </SecTitle>
      );
    case "paragraph":
      return <Para className="whitespace-pre-wrap break-words">{block.text}</Para>;
    case "button":
      return (
        <Flex justify="center">
          <LinkButton href={block.url} variant="outline">
            {block.label}
          </LinkButton>
        </Flex>
      );
    case "image":
      return (
        <AppImage src={block.src} alt={block.alt ?? ""} sizes="card" objectFit="contain" className="aspect-video w-full rounded-md bg-muted" />
      );
    case "divider":
      return <Block className="border-t border-border" data-slot="notice-divider" />;
    case "keyValueTable":
      return (
        <Grid className="grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md bg-muted p-3" data-slot="notice-key-value">
          {block.rows.flatMap((row, index) => [
            <Para key={`k${index}`} size="sm" tone="muted">
              {row.key}
            </Para>,
            <Para key={`v${index}`} size="sm" className="break-words">
              {row.value}
            </Para>,
          ])}
        </Grid>
      );
    case "bulletList":
      return (
        <Stack gap="2xs" data-slot="notice-bullets">
          {block.items.map((item, index) => (
            <Para key={index} className="break-words">
              ・{item}
            </Para>
          ))}
        </Stack>
      );
  }
}

export function NoticeInApp({ values }: NoticeInAppProps) {
  const blocks = ((values as { blocks?: MessageBlock[] }).blocks ?? []) as MessageBlock[];
  return (
    <Stack gap="sm" data-slot="notice-in-app">
      {blocks.map((block, index) => (
        <NoticeBlock key={index} block={block} />
      ))}
    </Stack>
  );
}
