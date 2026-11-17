// src/features/core/messaging/layouts/simple/SimpleInApp.default.tsx
// ひな形「シンプルなお知らせ」のお知らせ(受け取り箱の詳しい表示)の既定の見た目。props だけの部品(hook なし)。
// サムネイル → 本文 → リンクのボタン。件名は呼び手(受け取り箱の画面)が見出しに出すので、ここは本文から

import { LinkButton } from "@/components/Form/Button/LinkButton";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { AppImage } from "@/components/Media/AppImage";
import { Para } from "@/components/TextBlocks/Para";
import type { MessageLayoutSummary, MessageLayoutValues } from "@/lib/messaging";

export type SimpleInAppProps = {
  values: MessageLayoutValues;
  summary: MessageLayoutSummary;
};

type SimpleFields = { image?: string; body?: string; link?: { label: string; url: string } };

export function SimpleInApp({ values }: SimpleInAppProps) {
  const { image, body, link } = values as SimpleFields;
  return (
    <Stack gap="sm" data-slot="simple-in-app">
      {image ? (
        <AppImage src={image} alt="" sizes="card" objectFit="contain" className="aspect-video w-full rounded-md bg-muted" />
      ) : null}
      {body ? <Para className="whitespace-pre-wrap break-words">{body}</Para> : null}
      {link?.url ? (
        <Flex justify="center">
          <LinkButton href={link.url} variant="outline">
            {link.label}
          </LinkButton>
        </Flex>
      ) : null}
    </Stack>
  );
}
