// src/domains/core/messaging/layouts/link/LinkInApp.default.tsx
// レイアウト「認証のリンク」のお知らせ(受け取り箱の詳しい表示)の既定の見た目。props だけの部品(hook なし)。
// 件名は呼び手(受け取り箱の画面)が見出しに出すので、ここは受付の文・ボタンの案内・ボタン

import { LinkButton } from "@/components/Button/LinkButton";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import type { MessageLayoutSummary } from "@/lib/messaging";

import type { LinkValues } from "./layout";

export type LinkInAppProps = {
  values: LinkValues;
  summary: MessageLayoutSummary;
};

export function LinkInApp({ values }: LinkInAppProps) {
  const { received, buttonGuide, button } = values;
  return (
    <Stack gap="sm" data-slot="link-in-app">
      {received ? <Para className="whitespace-pre-wrap break-words">{received}</Para> : null}
      {buttonGuide ? <Para className="whitespace-pre-wrap break-words">{buttonGuide}</Para> : null}
      {button ? (
        <Flex justify="center">
          <LinkButton href={button.url} variant="outline">
            {button.label}
          </LinkButton>
        </Flex>
      ) : null}
    </Stack>
  );
}
