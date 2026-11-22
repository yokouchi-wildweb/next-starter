// src/domains/core/messaging/layouts/welcome/WelcomeInApp.default.tsx
// レイアウト「ようこそ」のお知らせ(受け取り箱の詳しい表示)の既定の見た目。props だけの部品(hook なし)。
// 件名は呼び手(受け取り箱の画面)が見出しに出すので、ここは札・お祝いの見出し・お礼・案内・ボタン

import { LinkButton } from "@/components/Button/LinkButton";
import { Flex } from "@/components/Layout/Flex";
import { Stack } from "@/components/Layout/Stack";
import { Para } from "@/components/TextBlocks/Para";
import type { MessageLayoutSummary } from "@/lib/messaging";

import type { WelcomeValues } from "./layout";

export type WelcomeInAppProps = {
  values: WelcomeValues;
  summary: MessageLayoutSummary;
};

export function WelcomeInApp({ values }: WelcomeInAppProps) {
  const { badge, heading, thanks, guide, button } = values;
  return (
    <Stack gap="sm" data-slot="welcome-in-app">
      {badge ? (
        <Para size="sm" tone="muted" align="center">
          {badge}
        </Para>
      ) : null}
      {heading ? (
        <Para weight="bold" align="center" tone="primary">
          {heading}
        </Para>
      ) : null}
      {thanks ? <Para align="center" className="whitespace-pre-wrap break-words">{thanks}</Para> : null}
      {guide ? <Para align="center" className="whitespace-pre-wrap break-words">{guide}</Para> : null}
      {button ? (
        <Flex justify="center">
          <LinkButton href={button.url}>{button.label}</LinkButton>
        </Flex>
      ) : null}
    </Stack>
  );
}
